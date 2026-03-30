// ============================================================================
// INTZ v11 – supabase/client.js
//
// Én global Supabase-klient for hele appen.
// Krever at du fyller inn dine egne nøkkelverdier.
//
// Denne filen gjør KUN:
//   • createClient()
//   • eksporterer 'supa' som global klient
//
// Ingen funksjoner kalles automatisk. Ingen nettverkskall gjøres
// før sync.js spesifikt bruker klienten.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// ❗ FYLL INN EGNE NØKLER HER
// ============================================================================

const SUPABASE_URL = "";     // f.eks. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = ""; // Public "anon" API-key

// Sikkerhet:
//  - dette er helt OK i en client-side app, så lenge reglene i Supabase RLS
//    er riktig satt opp (Row Level Security).
//  - Du bør IKKE legge inn service_role-key her (den er kun for backend).
// ============================================================================

export const supa = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ============================================================================
// Helper: sjekk at klient er satt opp før du bruker den
// ============================================================================

export function ensureSupabase() {
  if (!supa) {
    throw new Error(
      "Supabase-klienten er ikke konfigurert. Fyll inn SUPABASE_URL og SUPABASE_ANON_KEY i supabase/client.js"
    );
  }
  return supa;
}
