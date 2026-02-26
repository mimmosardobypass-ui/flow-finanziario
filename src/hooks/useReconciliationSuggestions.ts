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

export function computeSuggestionsForTransaction(
  source: MinimalTxn,
  allTransactions: MinimalTxn[],
  userId: string,
): SuggestionRow[] {
  const sourceDate = new Date(source.date).getTime();
  const TEN_DAYS = 10 * 86400_000;
  const results: SuggestionRow[] = [];

  const sourceTokens = source.description ? extractTokens(source.description) : [];
  const sourceIds = source.description ? extractIds(source.description) : [];

  for (const candidate of allTransactions) {
    if (candidate.id === source.id) continue;
    if (candidate.conto_id === source.conto_id) continue;
    if (candidate.deleted_at) continue;
    if (candidate.reconciliation_status === "reconciled") continue;

    const candDate = new Date(candidate.date).getTime();
    const dateDelta = Math.abs(sourceDate - candDate);
    if (dateDelta > TEN_DAYS) continue;

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

    if (score >= 40) {
      results.push({
        source_transaction_id: source.id,
        candidate_transaction_id: candidate.id,
        score,
        reason: reasons.join(" + "),
        user_id: userId,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  // Limit to top 3 suggestions per source transaction
  return results.slice(0, 3);
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
) {
  if (transactionIds.length === 0) return;

  console.log(`[suggestions] generateSuggestionsForIds called with ${transactionIds.length} IDs`);

  // Fetch all non-deleted transactions for the user
  const { data: allTxns, error } = await supabase
    .from("transactions")
    .select("id, date, amount, type, conto_id, description, reconciliation_status, deleted_at, reconciliation_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(2000);

  if (error || !allTxns) {
    console.error("[suggestions] Error fetching transactions:", error);
    return;
  }
  console.log(`[suggestions] Total transactions fetched: ${allTxns.length}`);

  const sourceTxns = allTxns.filter((t) => transactionIds.includes(t.id));
  const allSuggestions: SuggestionRow[] = [];

  console.log(`[suggestions] Source transactions to process: ${sourceTxns.length}`);

  for (const src of sourceTxns) {
    if (src.reconciliation_status === "reconciled") continue;
    const suggestions = computeSuggestionsForTransaction(
      src as MinimalTxn,
      allTxns as MinimalTxn[],
      userId,
    );
    allSuggestions.push(...suggestions);
  }

  console.log(`[suggestions] Total suggestions generated: ${allSuggestions.length}`);

  // Fetch dismissed pairs to preserve them across recalculation
  const dismissedPairs = new Set<string>();
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
  const filteredSuggestions = allSuggestions.filter(
    (s) => !dismissedPairs.has(`${s.source_transaction_id}|${s.candidate_transaction_id}`),
  );

  // Delete old non-dismissed suggestions for these source transactions
  if (transactionIds.length > 0) {
    await supabase
      .from("reconciliation_suggestions" as any)
      .delete()
      .in("source_transaction_id", transactionIds)
      .eq("dismissed", false);
  }

  // Insert new suggestions in chunks
  if (filteredSuggestions.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < filteredSuggestions.length; i += chunkSize) {
      const chunk = filteredSuggestions.slice(i, i + chunkSize);
      await supabase.from("reconciliation_suggestions" as any).insert(chunk);
    }
  }

  // Collect all affected IDs (source + candidate) for sync
  const affectedIds = new Set<string>();
  transactionIds.forEach((id) => affectedIds.add(id));
  filteredSuggestions.forEach((s) => {
    affectedIds.add(s.source_transaction_id);
    affectedIds.add(s.candidate_transaction_id);
  });

  // Use centralised sync to set correct status
  await syncReconciliationStatusForTransactions(Array.from(affectedIds));
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

      // Fetch all non-reconciled transaction IDs
      const { data: txns, error } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("reconciliation_status", ["none", "unreconciled"])
        .limit(2000);

      if (error) throw error;
      if (!txns || txns.length === 0) return 0;

      const ids = txns.map((t) => t.id);
      console.log(`[suggestions] Recalculating for ${ids.length} transactions`);

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await generateSuggestionsForIds(batch, user.id);
      }

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      console.log(`[suggestions] Recalculation complete for ${count} transactions`);
    },
  });
}
