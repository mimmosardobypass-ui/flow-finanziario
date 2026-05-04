import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getOrCreateGirocontiCategory, getDaClassificareIds } from "./useReconciliation";

const SESSION_KEY = "giroconti_fix_done";

function wasGirocontiFixDone() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markGirocontiFixDone() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage can be blocked inside the Lovable preview iframe.
  }
}

export function useFixExistingGiroconti() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    if (wasGirocontiFixDone()) return;

    const fix = async () => {
      try {
        // Get "Da classificare" category IDs
        const daClassificareIds = await getDaClassificareIds(user.id);

        // Find transfer-reconciled transactions that need fixing
        const { data: txns } = await supabase
          .from("transactions")
          .select("id, category_id")
          .eq("reconciliation_type", "transfer")
          .eq("reconciliation_status", "reconciled")
          .is("deleted_at", null);

        if (!txns || txns.length === 0) {
          markGirocontiFixDone();
          return;
        }

        // Filter those with null category or "Da classificare"
        const idsToFix = txns
          .filter((t) => !t.category_id || daClassificareIds.has(t.category_id))
          .map((t) => t.id);

        if (idsToFix.length === 0) {
          markGirocontiFixDone();
          return;
        }

        const girocontiCatId = await getOrCreateGirocontiCategory(user.id);

        await supabase
          .from("transactions")
          .update({ category_id: girocontiCatId })
          .in("id", idsToFix);

        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      } catch (e) {
        console.error("Fix giroconti failed:", e);
      } finally {
        markGirocontiFixDone();
      }
    };

    fix();
  }, [user, queryClient]);
}
