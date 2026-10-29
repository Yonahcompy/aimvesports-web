import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// En el servidor (rutas /api/*) usa SUPABASE_SERVICE_ROLE_KEY para operar con privilegios de sistema.
// En el navegador del cliente (window !== undefined) usa exclusivamente la llave publica de solo lectura.
const activeKey =
  typeof window === "undefined" && supabaseServiceKey
    ? supabaseServiceKey
    : supabaseAnonKey;

export const supabase = createClient(supabaseUrl, activeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});