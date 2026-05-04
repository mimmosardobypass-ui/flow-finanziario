import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TransactionWithCategory } from "./useTransactions";

/* ─── text normalisation helpers ─── */

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

const STRONG_KEYWORDS = new Set([
  "sumup", "payout", "postepay", "bonifico", "giroconto", "postagiro", "compass",
  "paypal", "stripe", "sepa", "addebito", "accredito", "trasferimento",
  "stipendio", "affitto", "bolletta", "rid", "mav", "rav",
]);

function extractTokens(text: string): string[] {
  return normalise(text).split(" ").filter((t) => t.length >= 3);
}

/** Sequences of 8+ alphanumeric chars that could be CRO/TRN/IDs */
function extractIds(text: string): string[] {
  const matches = normalise(text).match(/[a-z0-9]{8,}/g);
  return matches || [];
}

/* ─── scoring ─── */

export interface SuggestionRow {
  source_transaction_id: string;
  candidate_transaction_id: string;
  score: number;
  reason: string;
  user_id: string;
}

interface MinimalTxn {
  id: string;
  date: string;
  amount: number;
  type: string;
  conto_id: string;
  description: string | null;
  reconciliation_status: string;
  deleted_at: string | null;
  reconciliation_id: string | null;
}

// POSTAGIRO debug IDs
const POSTAGIRO_IDS = ["b13f8ccc", "3d134d53"];

export interface DiscardMetrics {
  discard_same_transaction: number;
  discard_same_account: number;
  discard_deleted: number;
  discard_already_reconciled: number;
  discard_date_out_of_range: number;
  discard_not_opposite_type: number;
  discard_score_below_threshold: number;
  discard_top3_trimmed: number;
  candidate_pairs_evaluated: number;
  suggestions_kept: number;
}

function emptyMetrics(): DiscardMetrics {
  return {
    discard_same_transaction: 0,
    discard_same_account: 0,
    discard_deleted: 0,
    discard_already_reconciled: 0,
    discard_date_out_of_range: 0,
    discard_not_opposite_type: 0,
    discard_score_below_threshold: 0,
    discard_top3_trimmed: 0,
    candidate_pairs_evaluated: 0,
    suggestions_kept: 0,
  };
}

export function computeSuggestionsForTransaction(
  source: MinimalTxn,
  allTransactions: MinimalTxn[],
  userId: string,
  metrics?: DiscardMetrics,
): SuggestionRow[] {
  const sourceDate = new Date(source.date).getTime();
  const TEN_DAYS = 10 * 86400_000;
  const results: SuggestionRow[] = [];
  const isPostagiroSource = POSTAGIRO_IDS.some((d) => source.id.startsWith(d));

  const sourceTokens = source.description ? extractTokens(source.description) : [];
  const sourceIds = source.description ? extractIds(source.description) : [];

  for (const candidate of allTransactions) {
    const isPostagiroPair = isPostagiroSource && POSTAGIRO_IDS.some((d) => candidate.id.startsWith(d));

    if (candidate.id === source.id) {
      if (metrics) metrics.discard_same_transaction++;
      continue;
    }
    if (candidate.conto_id === source.conto_id) {
      if (metrics) metrics.discard_same_account++;
      if (isPostagiroPair) console.log(`[RIC_POSTAGIRO] source=${source.id.slice(0,8)} candidate=${candidate.id.slice(0,8)} excluded_by=same_account`);
      continue;
    }
    if (candidate.deleted_at) {
      if (metrics) metrics.discard_deleted++;
      if (isPostagiroPair) console.log(`[RIC_POSTAGIRO] source=${source.id.slice(0,8)} candidate=${candidate.id.slice(0,8)} excluded_by=deleted`);
      continue;
    }
    if (candidate.reconciliation_status === "reconciled") {
      if (metrics) metrics.discard_already_reconciled++;
      if (isPostagiroPair) console.log(`[RIC_POSTAGIRO] source=${source.id.slice(0,8)} candidate=${candidate.id.slice(0,8)} excluded_by=already_reconciled`);
      continue;
    }

    const candDate = new Date(candidate.date).getTime();
    const dateDelta = Math.abs(sourceDate - candDate);
    if (dateDelta > TEN_DAYS) {
      if (metrics) metrics.discard_date_out_of_range++;
      if (isPostagiroPair) console.log(`[RIC_POSTAGIRO] source=${source.id.slice(0,8)} candidate=${candidate.id.slice(0,8)} excluded_by=date_out_of_range delta=${Math.round(dateDelta/86400_000)}d`);
      continue;
    }

    if (metrics) metrics.candidate_pairs_evaluated++;

    let score = 0;
    const reasons: string[] = [];
    const dateDays = Math.round(dateDelta / 86400_000);

    // Amount matching (absolute) — only score if opposite type (income vs expense)
    const srcAmt = source.amount;
    const candAmt = candidate.amount;
    const oppositeType = source.type !== candidate.type;

    if (Math.abs(srcAmt - candAmt) < 0.01 && oppositeType) {
      score += 50;
      reasons.push("same_amount_abs");
    } else if (
      oppositeType &&
      Math.abs(srcAmt - candAmt) / Math.max(srcAmt, candAmt, 0.01) <= 0.05
    ) {
      score += 30;
      reasons.push(`similar_amount(${Math.round(Math.abs(srcAmt - candAmt) * 100) / 100})`);
    }

    // Date closeness
    if (dateDays <= 3) {
      score += 20;
      reasons.push(`date_delta:${dateDays}`);
    } else if (dateDays <= 10) {
      score += 10;
      reasons.push(`date_delta:${dateDays}`);
    }

    // Opposite type bonus (transfer pattern)
    if (oppositeType) {
      score += 10;
      reasons.push("opposite_type");
    }

    // Internal transfer bonus: same abs amount + opposite sign + transfer keyword
    const TRANSFER_KEYWORDS = ["giroconto", "postagiro", "trasferimento"];
    if (
      source.type !== candidate.type &&
      Math.abs(srcAmt - candAmt) < 0.01 &&
      source.description && candidate.description
    ) {
      const srcHasTransfer = TRANSFER_KEYWORDS.some((kw) => normalise(source.description!).includes(kw));
      const candHasTransfer = TRANSFER_KEYWORDS.some((kw) => normalise(candidate.description!).includes(kw));
      if (srcHasTransfer || candHasTransfer) {
        score += 15;
        reasons.push("internal_transfer");
      }
    }

    // Keyword matching
    if (candidate.description) {
      const candTokens = extractTokens(candidate.description);
      const candIds = extractIds(candidate.description);

      // Strong keyword match
      const commonStrong = sourceTokens.filter(
        (t) => STRONG_KEYWORDS.has(t) && candTokens.includes(t),
      );
      if (commonStrong.length > 0) {
        score += 15 * commonStrong.length;
        reasons.push(`keyword:${commonStrong.join(",")}`);
      }

      // ID match (CRO, TRN, etc.)
      const commonIds = sourceIds.filter((id) => candIds.includes(id));
      if (commonIds.length > 0) {
        score += 25;
        reasons.push(`id_match:${commonIds[0]}`);
      }
    }

    if (isPostagiroPair) {
      console.log(`[RIC_POSTAGIRO] source=${source.id.slice(0,8)} candidate=${candidate.id.slice(0,8)} score=${score} reasons=${reasons.join("+")} oppositeType=${oppositeType} srcType=${source.type} candType=${candidate.type} ${score >= 40 ? "KEPT" : "excluded_by=score_below_threshold"}`);
    }

    if (score >= 40) {
      results.push({
        source_transaction_id: source.id,
        candidate_transaction_id: candidate.id,
        score,
        reason: reasons.join(" + "),
        user_id: userId,
      });
    } else {
      if (metrics) metrics.discard_score_below_threshold++;
    }
  }

  results.sort((a, b) => b.score - a.score);
  const trimmed = results.slice(0, 3);
  if (metrics) {
    metrics.discard_top3_trimmed += results.length - trimmed.length;
    metrics.suggestions_kept += trimmed.length;
  }
  return trimmed;
}

/* ─── centralised status sync (single source of truth) ─── */

/**
 * For each transactionId, sets reconciliation_status based on active suggestions:
 * - reconciled → skip (never touch)
 * - has active suggestions (as source OR candidate) → suggested
 * - no active suggestions → none
 */
async function syncReconciliationStatusForTransactions(transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const uniqueIds = [...new Set(transactionIds)];

  // Fetch current status for all IDs
  const { data: txns, error: fetchErr } = await supabase
    .from("transactions")
    .select("id, reconciliation_status")
    .in("id", uniqueIds);

  if (fetchErr) {
    console.error("[RIC_SYNC] Error fetching transactions:", fetchErr);
    throw fetchErr;
  }
  if (!txns || txns.length === 0) return;

  // Skip already reconciled
  const nonReconciled = txns.filter((t) => t.reconciliation_status !== "reconciled");
  if (nonReconciled.length === 0) return;

  const idsToCheck = nonReconciled.map((t) => t.id);

  // Fetch all active suggestions involving these IDs (as source or candidate)
  const { data: asSource, error: srcErr } = await supabase
    .from("reconciliation_suggestions" as any)
    .select("source_transaction_id")
    .in("source_transaction_id", idsToCheck)
    .eq("dismissed", false)
    .limit(2000);

  if (srcErr) {
    console.error("[RIC_SYNC] Error fetching source suggestions:", srcErr);
    throw srcErr;
  }

  const { data: asCandidate, error: candErr } = await supabase
    .from("reconciliation_suggestions" as any)
    .select("candidate_transaction_id")
    .in("candidate_transaction_id", idsToCheck)
    .eq("dismissed", false)
    .limit(2000);

  if (candErr) {
    console.error("[RIC_SYNC] Error fetching candidate suggestions:", candErr);
    throw candErr;
  }

  const hasActiveSuggestion = new Set<string>();
  (asSource || []).forEach((r: any) => hasActiveSuggestion.add(r.source_transaction_id));
  (asCandidate || []).forEach((r: any) => hasActiveSuggestion.add(r.candidate_transaction_id));

  // Debug logging for POSTAGIRO transactions
  const DEBUG_IDS = ["b13f8ccc", "3d134d53"];
  for (const t of nonReconciled) {
    if (DEBUG_IDS.some((d) => t.id.startsWith(d))) {
      console.log(`[RIC_SYNC] id=${t.id.slice(0, 12)} current=${t.reconciliation_status} hasActive=${hasActiveSuggestion.has(t.id)} → ${hasActiveSuggestion.has(t.id) ? "suggested" : "none"}`);
    }
  }

  // Set suggested for those with active suggestions
  const toSuggest = idsToCheck.filter((id) => hasActiveSuggestion.has(id));
  if (toSuggest.length > 0) {
    const { error: sugErr } = await supabase
      .from("transactions")
      .update({ reconciliation_status: "suggested" })
      .in("id", toSuggest)
      .neq("reconciliation_status", "suggested");
    if (sugErr) {
      console.error("[RIC_SYNC] Error setting suggested:", sugErr);
      throw sugErr;
    }
    console.log(`[RIC_SYNC] Set ${toSuggest.length} transactions to 'suggested'`);
  }

  // Set none for those without active suggestions
  const toNone = idsToCheck.filter((id) => !hasActiveSuggestion.has(id));
  if (toNone.length > 0) {
    const { error: noneErr } = await supabase
      .from("transactions")
      .update({ reconciliation_status: "none" })
      .in("id", toNone)
      .eq("reconciliation_status", "suggested");
    if (noneErr) {
      console.error("[RIC_SYNC] Error setting none:", noneErr);
      throw noneErr;
    }
    console.log(`[RIC_SYNC] Set ${toNone.length} transactions to 'none'`);
  }
}

/* ─── bulk generation ─── */

export async function generateSuggestionsForIds(
  transactionIds: string[],
  userId: string,
): Promise<DiscardMetrics> {
  const metrics = emptyMetrics();
  if (transactionIds.length === 0) return metrics;

  console.log(`[RIC_RECALC] generateSuggestionsForIds batch size=${transactionIds.length}`);

  // Fetch source transactions first to compute date window
  const { data: srcRows, error: srcErr } = await supabase
    .from("transactions")
    .select("id, date")
    .in("id", transactionIds);
  if (srcErr || !srcRows || srcRows.length === 0) {
    console.error("[RIC_RECALC] Error fetching source transactions:", srcErr);
    return metrics;
  }
  const srcDates = srcRows.map((r: any) => new Date(r.date).getTime());
  const minDate = new Date(Math.min(...srcDates) - 11 * 86400_000).toISOString().split("T")[0];
  const maxDate = new Date(Math.max(...srcDates) + 11 * 86400_000).toISOString().split("T")[0];

  // Fetch candidates within ±10 days window (algorithm only matches within 10d).
  // Paginate to bypass the 1000-row default limit.
  const allTxns: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("transactions")
      .select("id, date, amount, type, conto_id, description, reconciliation_status, deleted_at, reconciliation_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("date", minDate)
      .lte("date", maxDate)
      .order("date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[RIC_RECALC] Error fetching transactions:", error);
      return metrics;
    }
    if (!page || page.length === 0) break;
    allTxns.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  console.log(`[RIC_RECALC] Window ${minDate}..${maxDate} — fetched ${allTxns.length} candidates`);

  const sourceTxns = allTxns.filter((t) => transactionIds.includes(t.id));
  const allSuggestions: SuggestionRow[] = [];

  console.log(`[RIC_RECALC] Source transactions to process: ${sourceTxns.length}`);

  for (const src of sourceTxns) {
    if (src.reconciliation_status === "reconciled") continue;
    const suggestions = computeSuggestionsForTransaction(
      src as MinimalTxn,
      allTxns as MinimalTxn[],
      userId,
      metrics,
    );
    allSuggestions.push(...suggestions);
  }

  console.log(`[RIC_RECALC] Total suggestions generated: ${allSuggestions.length}`);

  // Fetch dismissed pairs to preserve them across recalculation
  const dismissedPairs = new Set<string>();
  let discard_previously_dismissed = 0;
  if (transactionIds.length > 0) {
    const { data: dismissedRows } = await supabase
      .from("reconciliation_suggestions" as any)
      .select("source_transaction_id, candidate_transaction_id")
      .in("source_transaction_id", transactionIds)
      .eq("dismissed", true);

    (dismissedRows || []).forEach((r: any) => {
      dismissedPairs.add(`${r.source_transaction_id}|${r.candidate_transaction_id}`);
    });
  }

  // Filter out previously dismissed pairs
  const filteredSuggestions = allSuggestions.filter((s) => {
    const key = `${s.source_transaction_id}|${s.candidate_transaction_id}`;
    if (dismissedPairs.has(key)) {
      discard_previously_dismissed++;
      return false;
    }
    return true;
  });

  // Delete old non-dismissed suggestions for these source transactions
  if (transactionIds.length > 0) {
    await supabase
      .from("reconciliation_suggestions" as any)
      .delete()
      .in("source_transaction_id", transactionIds)
      .eq("dismissed", false);
  }

  // Insert new suggestions in chunks
  let insertedCount = 0;
  if (filteredSuggestions.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < filteredSuggestions.length; i += chunkSize) {
      const chunk = filteredSuggestions.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from("reconciliation_suggestions" as any).insert(chunk);
      if (insertErr) {
        console.error("[RIC_RECALC] Insert error:", insertErr);
      } else {
        insertedCount += chunk.length;
      }
    }
  }

  console.log(`[RIC_METRICS_BATCH] ${JSON.stringify({
    input_candidate_ids: transactionIds.length,
    candidate_pairs_evaluated: metrics.candidate_pairs_evaluated,
    suggestions_inserted: insertedCount,
    discard_same_transaction: metrics.discard_same_transaction,
    discard_same_account: metrics.discard_same_account,
    discard_deleted: metrics.discard_deleted,
    discard_already_reconciled: metrics.discard_already_reconciled,
    discard_date_out_of_range: metrics.discard_date_out_of_range,
    discard_not_opposite_type: metrics.discard_not_opposite_type,
    discard_score_below_threshold: metrics.discard_score_below_threshold,
    discard_previously_dismissed: discard_previously_dismissed,
    discard_top3_trimmed: metrics.discard_top3_trimmed,
  })}`);

  // Collect all affected IDs (source + candidate) for sync
  const affectedIds = new Set<string>();
  transactionIds.forEach((id) => affectedIds.add(id));
  filteredSuggestions.forEach((s) => {
    affectedIds.add(s.source_transaction_id);
    affectedIds.add(s.candidate_transaction_id);
  });

  // Use centralised sync to set correct status
  await syncReconciliationStatusForTransactions(Array.from(affectedIds));

  // Log POSTAGIRO result after sync
  for (const pid of POSTAGIRO_IDS) {
    const match = Array.from(affectedIds).find((id) => id.startsWith(pid));
    if (match) {
      const { data: txn } = await supabase
        .from("transactions")
        .select("id, reconciliation_status")
        .eq("id", match)
        .single();
      const { data: links } = await supabase
        .from("reconciliation_suggestions" as any)
        .select("id")
        .or(`source_transaction_id.eq.${match},candidate_transaction_id.eq.${match}`)
        .eq("dismissed", false);
      console.log(`[RIC_POSTAGIRO_RESULT] id=${match.slice(0,8)} status=${txn?.reconciliation_status} active_links=${(links || []).length}`);
    }
  }

  return metrics;
}

/* ─── React hooks ─── */

export function useSuggestionsForTransaction(transactionId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reconciliation-suggestions", transactionId],
    queryFn: async () => {
      if (!user || !transactionId) return [];

      // Get suggestions where this transaction is source OR candidate
      const { data: asSource } = await supabase
        .from("reconciliation_suggestions" as any)
        .select("*")
        .eq("source_transaction_id", transactionId)
        .eq("dismissed", false)
        .order("score", { ascending: false });

      const { data: asCandidate } = await supabase
        .from("reconciliation_suggestions" as any)
        .select("*")
        .eq("candidate_transaction_id", transactionId)
        .eq("dismissed", false)
        .order("score", { ascending: false });

      // Merge: for asCandidate, swap source/candidate so the "other" transaction is always candidate
      const fromSource = (asSource || []).map((s: any) => ({
        ...s,
        other_transaction_id: s.candidate_transaction_id,
      }));
      const fromCandidate = (asCandidate || []).map((s: any) => ({
        ...s,
        other_transaction_id: s.source_transaction_id,
      }));

      const all = [...fromSource, ...fromCandidate];
      // Deduplicate by other_transaction_id
      const seen = new Set<string>();
      return all.filter((s) => {
        if (seen.has(s.other_transaction_id)) return false;
        seen.add(s.other_transaction_id);
        return true;
      });
    },
    enabled: !!user && !!transactionId,
  });
}

export function useGenerateSuggestionsForTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      if (!user) throw new Error("Non autenticato");
      await generateSuggestionsForIds([transactionId], user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ suggestionId, transactionId }: { suggestionId: string; transactionId: string }) => {
      // Read the suggestion to get both transaction IDs before dismissing
      const { data: suggestion } = await supabase
        .from("reconciliation_suggestions" as any)
        .select("source_transaction_id, candidate_transaction_id")
        .eq("id", suggestionId)
        .single();

      const { error } = await supabase
        .from("reconciliation_suggestions" as any)
        .update({ dismissed: true })
        .eq("id", suggestionId);
      if (error) throw error;

      // Sync status for BOTH transactions (source + candidate), not just the one open in the panel
      const idsToSync: string[] = [transactionId];
      if (suggestion) {
        const s = suggestion as any;
        idsToSync.push(s.source_transaction_id, s.candidate_transaction_id);
      }
      await syncReconciliationStatusForTransactions([...new Set(idsToSync)]);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" });
    },
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceId,
      candidateId,
    }: {
      sourceId: string;
      candidateId: string;
    }) => {
      const reconciliation_id = crypto.randomUUID();

      // Set both transactions as reconciled
      const { error: e1 } = await supabase
        .from("transactions")
        .update({
          reconciliation_id,
          reconciliation_status: "reconciled",
          reconciliation_type: "transfer",
        } as any)
        .in("id", [sourceId, candidateId]);

      if (e1) throw e1;

      // Dismiss all suggestions for both transactions
      await supabase
        .from("reconciliation_suggestions" as any)
        .update({ dismissed: true })
        .or(`source_transaction_id.in.(${sourceId},${candidateId}),candidate_transaction_id.in.(${sourceId},${candidateId})`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
      await queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" });
    },
  });
}

export function useRecalculateAllSuggestions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non autenticato");
      console.log(`[RIC_RECALC] start user=${user.id.slice(0,8)}`);

      // Fetch all non-reconciled transaction IDs (paginated to bypass 1000-row limit)
      const txns: { id: string; reconciliation_status: string }[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error } = await supabase
          .from("transactions")
          .select("id, reconciliation_status")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .neq("reconciliation_status", "reconciled")
          .order("date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        txns.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      if (!txns || txns.length === 0) {
        console.log("[RIC_RECALC] No eligible transactions found");
        return 0;
      }

      // Log status distribution
      const dist: Record<string, number> = {};
      txns.forEach((t) => { dist[t.reconciliation_status] = (dist[t.reconciliation_status] || 0) + 1; });
      console.log(`[RIC_RECALC] status_distribution ${JSON.stringify(dist)}`);

      const ids = txns.map((t) => t.id);
      console.log(`[RIC_RECALC] eligible_ids=${ids.length}`);

      // Process in batches of 50
      const batchSize = 50;
      let totalInserted = 0;
      const totalMetrics = emptyMetrics();

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        console.log(`[RIC_RECALC] batch ${Math.floor(i/batchSize)+1}/${Math.ceil(ids.length/batchSize)} size=${batch.length}`);
        const batchMetrics = await generateSuggestionsForIds(batch, user.id);
        // Accumulate metrics
        for (const key of Object.keys(totalMetrics) as (keyof DiscardMetrics)[]) {
          totalMetrics[key] += batchMetrics[key];
        }
      }

      // Find main discard reason
      const discardEntries = Object.entries(totalMetrics)
        .filter(([k]) => k.startsWith("discard_"))
        .sort((a, b) => (b[1] as number) - (a[1] as number));
      const mainReason = discardEntries.length > 0 && (discardEntries[0][1] as number) > 0
        ? discardEntries[0][0]
        : "none";

      console.log(`[RIC_METRICS_TOTAL] ${JSON.stringify({ ...totalMetrics, discard_main_reason: mainReason })}`);
      console.log(`[RIC_RECALC] done processed=${ids.length}`);

      return ids.length;
    },
    onSuccess: async (count) => {
      console.log(`[RIC_RECALC_UI] success count=${count}`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      await queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" });
      await queryClient.refetchQueries({ queryKey: ["reconciliation-suggestions"], type: "active" });
    },
  });
}
