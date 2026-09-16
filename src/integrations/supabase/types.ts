export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categorization_rules: {
        Row: {
          active: boolean
          apply_to_categorized: boolean
          category_id: string
          conto_id: string | null
          created_at: string
          exclude_keywords: string[]
          id: string
          keywords: string[]
          match_type: string
          name: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          apply_to_categorized?: boolean
          category_id: string
          conto_id?: string | null
          created_at?: string
          exclude_keywords?: string[]
          id?: string
          keywords?: string[]
          match_type?: string
          name: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          apply_to_categorized?: boolean
          category_id?: string
          conto_id?: string | null
          created_at?: string
          exclude_keywords?: string[]
          id?: string
          keywords?: string[]
          match_type?: string
          name?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_unieuro: {
        Row: {
          codice_coupon: string
          coupon_usato: boolean | null
          data_registrazione: string | null
          id: string
          localita: string
          nome_cognome: string
          note: string | null
          primo_contatto_whatsapp: boolean | null
          promozione: string
          telefono: string
          usato_il: string | null
        }
        Insert: {
          codice_coupon: string
          coupon_usato?: boolean | null
          data_registrazione?: string | null
          id?: string
          localita: string
          nome_cognome: string
          note?: string | null
          primo_contatto_whatsapp?: boolean | null
          promozione: string
          telefono: string
          usato_il?: string | null
        }
        Update: {
          codice_coupon?: string
          coupon_usato?: boolean | null
          data_registrazione?: string | null
          id?: string
          localita?: string
          nome_cognome?: string
          note?: string | null
          primo_contatto_whatsapp?: boolean | null
          promozione?: string
          telefono?: string
          usato_il?: string | null
        }
        Relationships: []
      }
      conti: {
        Row: {
          attivo: boolean
          banca: string | null
          created_at: string
          id: string
          nome_conto: string
          saldo_iniziale: number
          user_id: string
        }
        Insert: {
          attivo?: boolean
          banca?: string | null
          created_at?: string
          id?: string
          nome_conto: string
          saldo_iniziale?: number
          user_id: string
        }
        Update: {
          attivo?: boolean
          banca?: string | null
          created_at?: string
          id?: string
          nome_conto?: string
          saldo_iniziale?: number
          user_id?: string
        }
        Relationships: []
      }
      documenti_pagamenti: {
        Row: {
          compensazione_id: string | null
          created_at: string
          data_imputazione: string | null
          fattura_id: string
          id: string
          importo_imputato: number
          note: string | null
          origine: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          compensazione_id?: string | null
          created_at?: string
          data_imputazione?: string | null
          fattura_id: string
          id?: string
          importo_imputato: number
          note?: string | null
          origine?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          compensazione_id?: string | null
          created_at?: string
          data_imputazione?: string | null
          fattura_id?: string
          id?: string
          importo_imputato?: number
          note?: string | null
          origine?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "fatture_fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "v_documenti_saldi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "v_fatture_sdi_mancanti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      fatture_fornitori: {
        Row: {
          category_id: string | null
          condizioni_pagamento: string | null
          created_at: string
          data_documento: string
          data_notifica: string | null
          data_pagamento: string | null
          data_scadenza: string | null
          data_verifica_sdi: string | null
          direzione: string
          fornitore_id: string | null
          id: string
          identificativo_sdi: string | null
          imponibile: number | null
          importo_scadenza: number | null
          iva: number | null
          mittente: string
          nome_file: string | null
          note: string | null
          numero_documento: string | null
          origine: string
          piva_mittente: string | null
          sdi_mancante: boolean
          stato_pagamento: string
          tipo: string
          totale: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          condizioni_pagamento?: string | null
          created_at?: string
          data_documento: string
          data_notifica?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          data_verifica_sdi?: string | null
          direzione?: string
          fornitore_id?: string | null
          id?: string
          identificativo_sdi?: string | null
          imponibile?: number | null
          importo_scadenza?: number | null
          iva?: number | null
          mittente: string
          nome_file?: string | null
          note?: string | null
          numero_documento?: string | null
          origine?: string
          piva_mittente?: string | null
          sdi_mancante?: boolean
          stato_pagamento?: string
          tipo?: string
          totale: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          condizioni_pagamento?: string | null
          created_at?: string
          data_documento?: string
          data_notifica?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          data_verifica_sdi?: string | null
          direzione?: string
          fornitore_id?: string | null
          id?: string
          identificativo_sdi?: string | null
          imponibile?: number | null
          importo_scadenza?: number | null
          iva?: number | null
          mittente?: string
          nome_file?: string | null
          note?: string | null
          numero_documento?: string | null
          origine?: string
          piva_mittente?: string | null
          sdi_mancante?: boolean
          stato_pagamento?: string
          tipo?: string
          totale?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatture_fornitori_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_fornitori_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_fornitori_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_fornitori_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      finanziamento_eventi: {
        Row: {
          created_at: string
          data: string
          descrizione: string
          esito: string
          id: string
          importo: number | null
          rata_id: string | null
          scadenziario_id: string
          tipo: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          descrizione: string
          esito?: string
          id?: string
          importo?: number | null
          rata_id?: string | null
          scadenziario_id: string
          tipo: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descrizione?: string
          esito?: string
          id?: string
          importo?: number | null
          rata_id?: string | null
          scadenziario_id?: string
          tipo?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finanziamento_eventi_rata_id_fkey"
            columns: ["rata_id"]
            isOneToOne: false
            referencedRelation: "scadenze_rate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_eventi_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "scadenziario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_eventi_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "v_finanziamenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_eventi_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_eventi_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      finanziamento_regole: {
        Row: {
          attiva: boolean
          confidenza: string
          conto_id: string | null
          created_at: string
          giorni_dopo: number
          giorni_prima: number
          id: string
          importo_max: number | null
          importo_min: number | null
          note: string | null
          ruolo: string
          scadenziario_id: string
          testo: string
          user_id: string
        }
        Insert: {
          attiva?: boolean
          confidenza?: string
          conto_id?: string | null
          created_at?: string
          giorni_dopo?: number
          giorni_prima?: number
          id?: string
          importo_max?: number | null
          importo_min?: number | null
          note?: string | null
          ruolo?: string
          scadenziario_id: string
          testo: string
          user_id: string
        }
        Update: {
          attiva?: boolean
          confidenza?: string
          conto_id?: string | null
          created_at?: string
          giorni_dopo?: number
          giorni_prima?: number
          id?: string
          importo_max?: number | null
          importo_min?: number | null
          note?: string | null
          ruolo?: string
          scadenziario_id?: string
          testo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finanziamento_regole_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_regole_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "scadenziario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanziamento_regole_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "v_finanziamenti"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori: {
        Row: {
          category_id: string | null
          codice_fiscale: string | null
          created_at: string
          id: string
          match_keyword: string | null
          nome: string
          note: string | null
          piva: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          codice_fiscale?: string | null
          created_at?: string
          id?: string
          match_keyword?: string | null
          nome: string
          note?: string | null
          piva?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          codice_fiscale?: string | null
          created_at?: string
          id?: string
          match_keyword?: string | null
          nome?: string
          note?: string | null
          piva?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornitori_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_rules: {
        Row: {
          active: boolean
          commissione_auto: boolean
          commissione_max_assoluta: number
          commissione_percent: number
          conto_dest_id: string | null
          conto_origine_id: string | null
          contropartita_categoria_id: string | null
          contropartita_dal: string | null
          created_at: string
          genera_contropartita: boolean
          giorni_max: number
          giorni_min: number
          id: string
          importo_match: string
          keywords_dest: string[]
          keywords_origine: string[]
          name: string
          priority: number
          reconciliation_type: string
          tolleranza_euro: number
          type_dest: string
          type_origine: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commissione_auto?: boolean
          commissione_max_assoluta?: number
          commissione_percent?: number
          conto_dest_id?: string | null
          conto_origine_id?: string | null
          contropartita_categoria_id?: string | null
          contropartita_dal?: string | null
          created_at?: string
          genera_contropartita?: boolean
          giorni_max?: number
          giorni_min?: number
          id?: string
          importo_match?: string
          keywords_dest?: string[]
          keywords_origine?: string[]
          name: string
          priority?: number
          reconciliation_type?: string
          tolleranza_euro?: number
          type_dest?: string
          type_origine?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commissione_auto?: boolean
          commissione_max_assoluta?: number
          commissione_percent?: number
          conto_dest_id?: string | null
          conto_origine_id?: string | null
          contropartita_categoria_id?: string | null
          contropartita_dal?: string | null
          created_at?: string
          genera_contropartita?: boolean
          giorni_max?: number
          giorni_min?: number
          id?: string
          importo_match?: string
          keywords_dest?: string[]
          keywords_origine?: string[]
          name?: string
          priority?: number
          reconciliation_type?: string
          tolleranza_euro?: number
          type_dest?: string
          type_origine?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_rules_conto_dest_id_fkey"
            columns: ["conto_dest_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_rules_conto_origine_id_fkey"
            columns: ["conto_origine_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_rules_contropartita_categoria_id_fkey"
            columns: ["contropartita_categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_suggestions: {
        Row: {
          candidate_transaction_id: string
          created_at: string
          dismissed: boolean
          id: string
          reason: string | null
          score: number
          source_transaction_id: string
          user_id: string
        }
        Insert: {
          candidate_transaction_id: string
          created_at?: string
          dismissed?: boolean
          id?: string
          reason?: string | null
          score: number
          source_transaction_id: string
          user_id: string
        }
        Update: {
          candidate_transaction_id?: string
          created_at?: string
          dismissed?: boolean
          id?: string
          reason?: string | null
          score?: number
          source_transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_suggestions_candidate_transaction_id_fkey"
            columns: ["candidate_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_suggestions_candidate_transaction_id_fkey"
            columns: ["candidate_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "reconciliation_suggestions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_suggestions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      regole_rate: {
        Row: {
          attiva: boolean
          created_at: string
          giorni_max: number
          giorni_min: number
          id: string
          marcatore: string
          nome: string
          numero_rate: number
          tolleranza_rata: number
          tolleranza_totale: number
          user_id: string
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          giorni_max?: number
          giorni_min?: number
          id?: string
          marcatore: string
          nome: string
          numero_rate?: number
          tolleranza_rata?: number
          tolleranza_totale?: number
          user_id: string
        }
        Update: {
          attiva?: boolean
          created_at?: string
          giorni_max?: number
          giorni_min?: number
          id?: string
          marcatore?: string
          nome?: string
          numero_rate?: number
          tolleranza_rata?: number
          tolleranza_totale?: number
          user_id?: string
        }
        Relationships: []
      }
      scadenze_rate: {
        Row: {
          confidenza: string | null
          created_at: string
          data_pagamento: string | null
          data_scadenza: string | null
          debito_residuo: number | null
          fonte_pagamento: string | null
          id: string
          importo: number | null
          importo_pagato: number | null
          nota: string | null
          numero_rata: number
          quota_capitale: number | null
          quota_interessi: number | null
          scadenziario_id: string
          spese: number
          stato: string
          stimata: boolean
          tentativi_falliti: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          confidenza?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_scadenza?: string | null
          debito_residuo?: number | null
          fonte_pagamento?: string | null
          id?: string
          importo?: number | null
          importo_pagato?: number | null
          nota?: string | null
          numero_rata: number
          quota_capitale?: number | null
          quota_interessi?: number | null
          scadenziario_id: string
          spese?: number
          stato?: string
          stimata?: boolean
          tentativi_falliti?: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          confidenza?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_scadenza?: string | null
          debito_residuo?: number | null
          fonte_pagamento?: string | null
          id?: string
          importo?: number | null
          importo_pagato?: number | null
          nota?: string | null
          numero_rata?: number
          quota_capitale?: number | null
          quota_interessi?: number | null
          scadenziario_id?: string
          spese?: number
          stato?: string
          stimata?: boolean
          tentativi_falliti?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scadenze_rate_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "scadenziario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenze_rate_scadenziario_id_fkey"
            columns: ["scadenziario_id"]
            isOneToOne: false
            referencedRelation: "v_finanziamenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenze_rate_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenze_rate_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      scadenziario: {
        Row: {
          beneficiario: string | null
          capitale: number | null
          category_id: string | null
          conto_id: string | null
          created_at: string
          data_erogazione: string | null
          data_estinzione: string | null
          data_prima_scadenza: string
          data_stipula: string | null
          fido: number | null
          forma: string | null
          giorno_addebito: number | null
          id: string
          importo_rata: number | null
          importo_totale: number
          intestatario: string | null
          mandato_sdd: string | null
          modalita_importo: string
          nome: string | null
          note: string | null
          numero_contratto: string
          numero_rate: number
          numero_utilizzo: number | null
          origine_piano: string | null
          residuo_ente: number | null
          residuo_ente_data: string | null
          societa_finanziaria: string
          stato: string
          taeg: number | null
          tan: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          beneficiario?: string | null
          capitale?: number | null
          category_id?: string | null
          conto_id?: string | null
          created_at?: string
          data_erogazione?: string | null
          data_estinzione?: string | null
          data_prima_scadenza: string
          data_stipula?: string | null
          fido?: number | null
          forma?: string | null
          giorno_addebito?: number | null
          id?: string
          importo_rata?: number | null
          importo_totale: number
          intestatario?: string | null
          mandato_sdd?: string | null
          modalita_importo: string
          nome?: string | null
          note?: string | null
          numero_contratto: string
          numero_rate: number
          numero_utilizzo?: number | null
          origine_piano?: string | null
          residuo_ente?: number | null
          residuo_ente_data?: string | null
          societa_finanziaria: string
          stato?: string
          taeg?: number | null
          tan?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          beneficiario?: string | null
          capitale?: number | null
          category_id?: string | null
          conto_id?: string | null
          created_at?: string
          data_erogazione?: string | null
          data_estinzione?: string | null
          data_prima_scadenza?: string
          data_stipula?: string | null
          fido?: number | null
          forma?: string | null
          giorno_addebito?: number | null
          id?: string
          importo_rata?: number | null
          importo_totale?: number
          intestatario?: string | null
          mandato_sdd?: string | null
          modalita_importo?: string
          nome?: string | null
          note?: string | null
          numero_contratto?: string
          numero_rate?: number
          numero_utilizzo?: number | null
          origine_piano?: string | null
          residuo_ente?: number | null
          residuo_ente_data?: string | null
          societa_finanziaria?: string
          stato?: string
          taeg?: number | null
          tan?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scadenziario_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          conto_id: string
          created_at: string
          date: string
          deleted_at: string | null
          description: string | null
          id: string
          operation_id: string | null
          rata_id: string | null
          reconciliation_id: string | null
          reconciliation_status: string
          reconciliation_type: string | null
          transfer_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          conto_id: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          operation_id?: string | null
          rata_id?: string | null
          reconciliation_id?: string | null
          reconciliation_status?: string
          reconciliation_type?: string | null
          transfer_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          conto_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          operation_id?: string | null
          rata_id?: string | null
          reconciliation_id?: string | null
          reconciliation_status?: string
          reconciliation_type?: string | null
          transfer_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_rata_id_fkey"
            columns: ["rata_id"]
            isOneToOne: false
            referencedRelation: "scadenze_rate"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_commissioni_sumup: {
        Row: {
          accorpato: boolean | null
          accreditato: number | null
          commissione: number | null
          data_accredito: string | null
          giorni_di_attesa: number | null
          gruppo: string | null
          incassato: number | null
          mese: string | null
          numero_incassi: number | null
          percentuale: number | null
          primo_incasso: string | null
          ultimo_incasso: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_documenti_saldi: {
        Row: {
          controparte: string | null
          data_documento: string | null
          data_scadenza: string | null
          direzione: string | null
          fornitore_id: string | null
          giorni_scaduta: number | null
          id: string | null
          imputato: number | null
          numero_documento: string | null
          origine: string | null
          residuo: number | null
          sdi_mancante: boolean | null
          segno: number | null
          stato_pagamento: string | null
          tipo: string | null
          totale: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fatture_fornitori_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
        ]
      }
      v_documento_pagamenti: {
        Row: {
          compensazione_id: string | null
          conto: string | null
          created_at: string | null
          data_movimento: string | null
          descrizione_movimento: string | null
          fattura_id: string | null
          importo_imputato: number | null
          importo_movimento: number | null
          legame_id: string | null
          origine: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "fatture_fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "v_documenti_saldi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_fattura_id_fkey"
            columns: ["fattura_id"]
            isOneToOne: false
            referencedRelation: "v_fatture_sdi_mancanti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documenti_pagamenti_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_movimenti_copertura"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      v_esposizione_controparti: {
        Row: {
          a_scadere: number | null
          aperto: number | null
          controparte: string | null
          direzione: string | null
          documenti: number | null
          scaduto_1_30: number | null
          scaduto_31_90: number | null
          scaduto_oltre_90: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_fatture_sdi_mancanti: {
        Row: {
          data_documento: string | null
          data_pagamento: string | null
          data_verifica_sdi: string | null
          giorni_attesa: number | null
          id: string | null
          livello: string | null
          mittente: string | null
          numero_documento: string | null
          origine: string | null
          stato_pagamento: string | null
          totale: number | null
          user_id: string | null
        }
        Insert: {
          data_documento?: string | null
          data_pagamento?: string | null
          data_verifica_sdi?: string | null
          giorni_attesa?: never
          id?: string | null
          livello?: never
          mittente?: string | null
          numero_documento?: string | null
          origine?: string | null
          stato_pagamento?: string | null
          totale?: number | null
          user_id?: string | null
        }
        Update: {
          data_documento?: string | null
          data_pagamento?: string | null
          data_verifica_sdi?: string | null
          giorni_attesa?: never
          id?: string | null
          livello?: never
          mittente?: string | null
          numero_documento?: string | null
          origine?: string | null
          stato_pagamento?: string | null
          totale?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_finanziamenti: {
        Row: {
          banca: string | null
          beneficiario: string | null
          capitale: number | null
          categoria_nome: string | null
          category_id: string | null
          conto_id: string | null
          created_at: string | null
          da_verificare: boolean | null
          data_erogazione: string | null
          data_estinzione: string | null
          data_fine: string | null
          data_prima_scadenza: string | null
          data_stipula: string | null
          differenza_residuo_ente: number | null
          fido: number | null
          forma: string | null
          giorno_addebito: number | null
          id: string | null
          importo_rata: number | null
          importo_totale: number | null
          interessi_residui: number | null
          intestatario: string | null
          mandato_sdd: string | null
          modalita_importo: string | null
          nome: string | null
          nome_conto: string | null
          note: string | null
          numero_contratto: string | null
          numero_rate: number | null
          numero_utilizzo: number | null
          origine_piano: string | null
          pagato_piano: number | null
          prossima_importo: number | null
          prossima_scadenza: string | null
          prossima_stimata: boolean | null
          rate_pagate: number | null
          rate_scadute: number | null
          rate_senza_movimento: number | null
          rate_totali: number | null
          residuo_capitale: number | null
          residuo_da_pagare: number | null
          residuo_ente: number | null
          residuo_ente_data: string | null
          societa_finanziaria: string | null
          spese_totali: number | null
          stato: string | null
          taeg: number | null
          tan: number | null
          tipo: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scadenziario_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_conto_id_fkey"
            columns: ["conto_id"]
            isOneToOne: false
            referencedRelation: "conti"
            referencedColumns: ["id"]
          },
        ]
      }
      v_movimenti_copertura: {
        Row: {
          amount: number | null
          coperto: number | null
          date: string | null
          description: string | null
          documenti_collegati: number | null
          residuo: number | null
          transaction_id: string | null
          type: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abbina_rate_finanziamenti: {
        Args: {
          p_includi_media?: boolean
          p_scadenziario_id?: string
          p_user_id: string
        }
        Returns: number
      }
      annulla_compensazione: {
        Args: { p_compensazione_id: string; p_user_id: string }
        Returns: Json
      }
      apply_categorization_rule: {
        Args: { p_rule_id: string; p_user_id: string }
        Returns: number
      }
      associa_documenti_movimento: {
        Args: {
          p_fattura_ids: string[]
          p_importi?: number[]
          p_transaction_id: string
          p_user_id: string
        }
        Returns: Json
      }
      collega_fattura_sdi: {
        Args: {
          p_data_notifica?: string
          p_mittente: string
          p_numero: string
          p_piva?: string
          p_sdi: string
          p_user_id: string
        }
        Returns: Json
      }
      collega_pagamenti_fatture: {
        Args: {
          p_fattura_ids: string[]
          p_transaction_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      collega_piano_rate: {
        Args: {
          p_crea_scadenziario?: boolean
          p_fattura_id: string
          p_transaction_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      collega_rata_finanziamento: {
        Args: {
          p_confidenza?: string
          p_rata_id: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: Json
      }
      compensa_documenti: {
        Args: {
          p_data?: string
          p_fattura_id: string
          p_importo?: number
          p_nota_id: string
          p_user_id: string
        }
        Returns: Json
      }
      count_categorization_rule_matches: {
        Args: { p_rule_id: string; p_user_id: string }
        Returns: number
      }
      crea_contropartita: {
        Args: { p_dest_id: string; p_rule_id: string; p_user_id: string }
        Returns: Json
      }
      crea_contropartite_batch: {
        Args: { p_items: Json; p_user_id: string }
        Returns: Json
      }
      dissocia_documento: {
        Args: {
          p_fattura_id: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: Json
      }
      find_combinazioni_documenti: {
        Args: {
          p_max_documenti?: number
          p_transaction_id: string
          p_user_id: string
        }
        Returns: {
          out_controparte: string
          out_ids: string[]
          out_numeri: string[]
          out_somma: number
        }[]
      }
      find_contropartite_mancanti: {
        Args: { p_user_id: string }
        Returns: {
          avviso: string
          dest_amount: number
          dest_conto: string
          dest_date: string
          dest_desc: string
          dest_id: string
          gia_esiste_simile: boolean
          origine_categoria: string
          origine_conto: string
          origine_data: string
          origine_importo: number
          rule_id: string
          rule_name: string
        }[]
      }
      find_documenti_per_movimento: {
        Args: {
          p_includi_associati?: boolean
          p_query?: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: {
          controparte: string
          data_documento: string
          data_scadenza: string
          direzione: string
          effetto: number
          fattura_id: string
          gia_associato: boolean
          giorni_scaduta: number
          importo_associato: number
          numero_documento: string
          residuo: number
          sdi_mancante: boolean
          suggerito: boolean
          tipo: string
          totale: number
        }[]
      }
      find_note_credito_compensabili: {
        Args: { p_fattura_id: string; p_user_id: string }
        Returns: {
          compensabile: number
          data_documento: string
          nota_id: string
          numero_documento: string
          residuo: number
          totale: number
        }[]
      }
      find_pagamenti_fatture: {
        Args: { p_user_id: string }
        Returns: {
          candidati: number
          confidenza: string
          data_documento: string
          data_pagamento: string
          descrizione: string
          fattura_id: string
          giorni: number
          importo_pagamento: number
          mittente: string
          numero_documento: string
          scarto: number
          totale: number
          transaction_id: string
        }[]
      }
      find_piani_rate: {
        Args: { p_user_id: string }
        Returns: {
          confidenza: string
          controparte: string
          data_documento: string
          date_rate: string[]
          fattura_id: string
          importi_rate: number[]
          importo_trovato: number
          numero_documento: string
          prossima_rata_attesa: string
          rate_previste: number
          rate_trovate: number
          residuo_fattura: number
          stato: string
          totale_fattura: number
          transaction_ids: string[]
        }[]
      }
      find_reconciliation_aggregates: {
        Args: { p_user_id: string }
        Returns: {
          commissione_euro: number
          dest_amount: number
          dest_conto: string
          dest_date: string
          dest_desc: string
          dest_id: string
          fuori_norma: boolean
          giorni: number
          percentuale: number
          rule_id: string
          rule_name: string
          source_al: string
          source_conto: string
          source_count: number
          source_dal: string
          source_ids: string[]
          source_totale: number
        }[]
      }
      find_reconciliation_matches: {
        Args: { p_user_id: string }
        Returns: {
          commissione_euro: number
          dest_amount: number
          dest_conto: string
          dest_date: string
          dest_desc: string
          dest_id: string
          dest_type: string
          differenza_euro: number
          fuori_norma: boolean
          giorni_distanza: number
          percentuale: number
          rule_id: string
          rule_name: string
          score: number
          source_amount: number
          source_conto: string
          source_date: string
          source_desc: string
          source_id: string
          source_type: string
        }[]
      }
      import_fattura_sdi: {
        Args: {
          p_condizioni_pagamento: string
          p_data_documento: string
          p_data_notifica: string
          p_data_scadenza: string
          p_identificativo_sdi: string
          p_imponibile: number
          p_importo_scadenza: number
          p_mittente: string
          p_nome_file: string
          p_numero_documento: string
          p_piva_mittente: string
          p_tipo: string
          p_totale: number
          p_user_id: string
        }
        Returns: Json
      }
      paga_documenti_contanti: {
        Args: {
          p_conto_id?: string
          p_data: string
          p_fattura_ids: string[]
          p_importi?: number[]
          p_nota?: string
          p_user_id: string
        }
        Returns: Json
      }
      reconcile_sumup_batch: {
        Args: { p_pairs: Json; p_user_id: string }
        Returns: Json
      }
      reconcile_sumup_group: {
        Args: {
          p_dest_id: string
          p_rule_id: string
          p_source_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      reconcile_sumup_groups_batch: {
        Args: { p_groups: Json; p_user_id: string }
        Returns: Json
      }
      reconcile_sumup_pair: {
        Args: {
          p_dest_id: string
          p_rule_id: string
          p_source_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reconciliation_osservazioni: {
        Args: { p_rule_id: string; p_user_id: string }
        Returns: {
          campione: number
          gg_med: number
          pct_max: number
          pct_med: number
          pct_min: number
        }[]
      }
      registra_residuo_ente: {
        Args: {
          p_data?: string
          p_importo: number
          p_scadenziario_id: string
          p_user_id: string
        }
        Returns: Json
      }
      ricalcola_stato_documento: {
        Args: { p_fattura_id: string }
        Returns: undefined
      }
      scollega_rata_finanziamento: {
        Args: { p_rata_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_user_data: { Args: { user_uuid: string }; Returns: undefined }
      segna_rata_pagata_ente: {
        Args: {
          p_data: string
          p_nota?: string
          p_rata_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      sincronizza_scadenziario_piano: {
        Args: { p_fattura_id: string; p_user_id: string }
        Returns: string
      }
      trova_rate_finanziamenti: {
        Args: { p_scadenziario_id?: string; p_user_id: string }
        Returns: {
          confidenza: string
          conto_id: string
          data_movimento: string
          data_scadenza: string
          descrizione: string
          giorni_scarto: number
          importo_movimento: number
          importo_rata: number
          numero_rata: number
          rata_id: string
          scadenziario_id: string
          transaction_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
