import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { TransactionWithCategory } from "./useTransactions";

function normalizeDesc(desc: string | null): string {
  return (desc ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function makeFingerprint(t: { conto_id: string; date: string; amount: number; description: string | null }): string {
  return `${t.conto_id}|${t.date}|${Math.abs(t.amount).toFixed(2)}|${normalizeDesc(t.description)}`;
}

export interface DuplicateGroup {
  fingerprint: string;
  transactions: TransactionWithCategory[];
  /** The one to keep (oldest created_at or smallest id) */
  keepId: string;
}

export function useDuplicateDetection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scan = async () => {
    if (!user) return;
    setScanning(true);
    try {
      const PAGE_SIZE = 1000;
      let allData: TransactionWithCategory[] = [];
      let from = 0;
      let hasMore = true;
      const seenIds = new Set<string>();

      while (hasMore) {
        const { data, error } = await supabase
          .from("transactions")
          .select(`*, categories(id, name, type), conti(id, nome_conto, banca)`)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;

        const rawBatch = (data ?? []) as TransactionWithCategory[];
        const batch = rawBatch.filter((transaction) => {
          if (seenIds.has(transaction.id)) return false;
          seenIds.add(transaction.id);
          return true;
        });

        allData = allData.concat(batch);
        hasMore = rawBatch.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Group by fingerprint
      const map = new Map<string, TransactionWithCategory[]>();
      for (const t of allData) {
        const fp = makeFingerprint(t);
        if (!map.has(fp)) map.set(fp, []);
        map.get(fp)!.push(t);
      }

      const duplicateGroups: DuplicateGroup[] = [];
      for (const [fingerprint, txs] of map) {
        const uniqueTxs = Array.from(new Map(txs.map((transaction) => [transaction.id, transaction])).values());
        if (uniqueTxs.length < 2) continue;
        // Sort by created_at asc, then id asc — first is the one to keep
        uniqueTxs.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
        duplicateGroups.push({
          fingerprint,
          transactions: uniqueTxs,
          keepId: uniqueTxs[0].id,
        });
      }

      setGroups(duplicateGroups);
    } finally {
      setScanning(false);
    }
  };

  const deleteSelected = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    setDeleting(true);
    try {
      const chunkSize = 100;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", chunk);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Remove deleted from groups
      setGroups((prev) =>
        prev
          .map((g) => {
            const remaining = g.transactions.filter((t) => !idsToDelete.includes(t.id));
            if (remaining.length < 2) return null;
            remaining.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
            return { ...g, transactions: remaining, keepId: remaining[0].id };
          })
          .filter((g): g is DuplicateGroup => g !== null)
      );
    } finally {
      setDeleting(false);
    }
  };

  return { groups, scanning, deleting, scan, deleteSelected, reset: () => setGroups([]) };
}
