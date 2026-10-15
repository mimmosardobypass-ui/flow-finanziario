import * as XLSX from "xlsx";

export function esportaExcel(nomeFile: string, fogli: { nome: string; righe: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const f of fogli) {
    const ws = XLSX.utils.json_to_sheet(f.righe.length ? f.righe : [{ Nota: "Nessun dato" }]);
    const chiavi = Object.keys(f.righe[0] ?? { Nota: "" });
    ws["!cols"] = chiavi.map((k) => ({ wch: Math.max(10, k.length + 2, ...f.righe.map((r) => String(r[k] ?? "").length + 1).slice(0, 200)) }));
    XLSX.utils.book_append_sheet(wb, ws, f.nome.slice(0, 31));
  }
  XLSX.writeFile(wb, nomeFile.endsWith(".xlsx") ? nomeFile : `${nomeFile}.xlsx`);
}

/** Arrotonda a 2 decimali per l'export. */
export const r2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
export const r1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
