export function messaggioErrore(error: unknown): string {
  const err = (error ?? {}) as Record<string, unknown>;
  const code = typeof err.code === "string" ? err.code : "";
  const message = typeof err.message === "string" ? err.message : "";
  const details = typeof err.details === "string" ? err.details : "";
  const testo = `${message} ${details}`.toLowerCase();

  if (code === "23505") {
    if (testo.includes("fatture_fornitori_user_sdi_uniq"))
      return "Esiste già una fattura con questo Identificativo SdI.";
    if (testo.includes("fatture_fornitori_user_forn_num_uniq"))
      return "Esiste già una fattura con questo numero per questo fornitore.";
    if (testo.includes("documenti_pagamenti"))
      return "Questo movimento è già collegato a questo documento.";
    return "Esiste già un elemento con questi dati.";
  }

  if (code === "23503")
    return "Operazione non possibile: questo dato è collegato ad altri elementi.";
  if (code === "23514") return "Valore non ammesso per questo campo.";
  if (code === "23502") return "Manca un campo obbligatorio.";
  if (
    code === "42501" ||
    testo.includes("non autorizzato") ||
    testo.includes("row-level security")
  )
    return "Operazione non autorizzata.";
  if (code === "PGRST202") return "Funzione non disponibile: ricarica la pagina.";

  return message || "Operazione non riuscita.";
}
