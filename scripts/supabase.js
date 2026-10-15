import { createClient } from
  "./vendor/supabase-2.117.3.js?v=20261015-2";

// Substitua pelos dados do seu projeto.
const SUPABASE_URL = "https://vvchheecppfrkirjrqeq.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_FPrOgmJ1INe8Pf2u_37jwQ_As-XVbWD";

// Exportamos a conexão para reutilizá-la nas outras páginas.
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_CHAVE_PUBLICA
);
