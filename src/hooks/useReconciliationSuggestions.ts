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

    // Amount matching (absolute)
    const srcAmt = source.amount;
    const candAmt = candidate.amount;
    if (Math.abs(srcAmt - candAmt) < 0.01) {
      score += 50;
      reasons.push("same_amount_abs");
    } else if (Math.abs(srcAmt - candAmt) / Math.max(srcAmt, candAmt, 0.01) <= 0.05) {
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

    // Opposite sign (transfer pattern)
    if (source.type !== candidate.type) {
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

    if (score >= 30) {
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
  return results;
}

/* ─── bulk generation ─── */

export async function generateSuggestionsForIds(
  transactionIds: string[],
  userId: string,
) {
  if (transactionIds.length === 0) return;

  console.log(`[suggestions] generateSuggestionsForIds called with ${transactionIds.length} IDs`);

  // Fetch all non-reconciled, non-deleted transactions for the user
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
  const affectedIds = new Set<string>();

  console.log(`[suggestions] Source transactions to process: ${sourceTxns.length}`);

  for (const src of sourceTxns) {
    if (src.reconciliation_status === "reconciled") continue;
    const suggestions = computeSuggestionsForTransaction(
      src as MinimalTxn,
      allTxns as MinimalTxn[],
      userId,
    );
    allSuggestions.push(...suggestions);
    if (suggestions.length > 0) {
      affectedIds.add(src.id);
      suggestions.forEach((s) => affectedIds.add(s.candidate_transaction_id));
    }
  }

  console.log(`[suggestions] Total suggestions generated: ${allSuggestions.length}`);

  // Delete old suggestions for these source transactions
  if (transactionIds.length > 0) {
    await supabase
      .from("reconciliation_suggestions" as any)
      .delete()
      .in("source_transaction_id", transactionIds);
  }

  // Insert new suggestions in chunks
  if (allSuggestions.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < allSuggestions.length; i += chunkSize) {
      const chunk = allSuggestions.slice(i, i + chunkSize);
      await supabase.from("reconciliation_suggestions" as any).insert(chunk);
    }
  }

  // Update reconciliation_status for source transactions
  const idsWithSuggestions = new Set(allSuggestions.map((s) => s.source_transaction_id));
  const idsWithCandidates = new Set(allSuggestions.map((s) => s.candidate_transaction_id));

  // Set 'suggested' for sources that got suggestions
  const toSuggest = transactionIds.filter((id) => idsWithSuggestions.has(id));
  if (toSuggest.length > 0) {
    await supabase
      .from("transactions")
      .update({ reconciliation_status: "suggested" })
      .in("id", toSuggest)
      .in("reconciliation_status", ["none", "unreconciled"]);
  }

  // Also mark candidates as suggested if they were 'none'
  const candidatesToSuggest = Array.from(idsWithCandidates).filter(
    (id) => !transactionIds.includes(id),
  );
  if (candidatesToSuggest.length > 0) {
    // Check if they already have suggestions as source
    const { data: existing } = await supabase
      .from("reconciliation_suggestions" as any)
      .select("source_transaction_id")
      .in("source_transaction_id", candidatesToSuggest)
      .eq("dismissed", false)
      .limit(1000);

    const alreadyHaveSuggestions = new Set(
      (existing || []).map((e: any) => e.source_transaction_id),
    );

    // For candidates that don't have their own suggestions as source, still mark suggested
    const needUpdate = candidatesToSuggest.filter(
      (id) => !alreadyHaveSuggestions.has(id),
    );
    if (needUpdate.length > 0) {
      await supabase
        .from("transactions")
        .update({ reconciliation_status: "suggested" })
        .in("id", needUpdate)
        .in("reconciliation_status", ["none", "unreconciled"]);
    }
  }

  // Set 'none' for sources with no suggestions (only if currently 'suggested')
  const toNone = transactionIds.filter((id) => !idsWithSuggestions.has(id));
  if (toNone.length > 0) {
    // Check they don't have suggestions as candidate either
    const { data: asCandidateRows } = await supabase
      .from("reconciliation_suggestions" as any)
      .select("candidate_transaction_id")
      .in("candidate_transaction_id", toNone)
      .eq("dismissed", false)
      .limit(1000);

    const hasAsCandidate = new Set(
      (asCandidateRows || []).map((r: any) => r.candidate_transaction_id),
    );
    const reallyNone = toNone.filter((id) => !hasAsCandidate.has(id));

    if (reallyNone.length > 0) {
      await supabase
        .from("transactions")
        .update({ reconciliation_status: "none" })
        .in("id", reallyNone)
        .eq("reconciliation_status", "suggested");
    }
  }
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
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("reconciliation_suggestions" as any)
        .update({ dismissed: true })
        .eq("id", suggestionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-group"] });
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
