/**
 * Converte il numero seriale di una data Excel in una Date locale.
 * Non usa XLSX.SSF, che non è raggiungibile dal bundle.
 * 25569 è il seriale Excel corrispondente al 1970-01-01.
 */
export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const utc = new Date(ms);
  if (Number.isNaN(utc.getTime())) return null;
  // ricostruita come data locale, per evitare slittamenti di fuso orario
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
