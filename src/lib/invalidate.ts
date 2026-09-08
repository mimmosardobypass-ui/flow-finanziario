import type { QueryClient } from "@tanstack/react-query";

export function invalidaMovimenti(qc: QueryClient) {
  [
    "transactions",
    "documenti-saldi",
    "movimenti-copertura",
    "documenti-per-movimento",
    "documento-pagamenti",
    "pagamenti-fatture",
    "esposizione-controparti",
    "combinazioni-documenti",
    "scadenziario",
    "scadenze_rate_unpaid",
    "saldo-conto",
    "reconciliation-suggestions",
    "fatture-fornitori",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function invalidaAnagrafiche(qc: QueryClient) {
  [
    "categories",
    "conti",
    "fornitori",
    "transactions",
    "fatture-fornitori",
    "documenti-saldi",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
