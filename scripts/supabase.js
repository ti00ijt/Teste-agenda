import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// Substitua pelos dados do seu projeto.
const SUPABASE_URL = "https://vvchheecppfrkirjrqeq.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_FPrOgmJ1INe8Pf2u_37jwQ_As-XVbWD";

// Exportamos a conexão para reutilizá-la nas outras páginas.
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_CHAVE_PUBLICA
);