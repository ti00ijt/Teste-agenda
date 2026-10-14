import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { erro: "Método não permitido." });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options);
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { erro: "Entre novamente na conta." });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.email) return reply(401, { erro: "Entre novamente na conta." });
    let body;
    try { body = await req.json(); } catch { return reply(400, { erro: "Dados inválidos." }); }
    if (!body || typeof body.mensagem_id !== "string" || !uuid.test(body.mensagem_id)
      || typeof body.nome_responsavel !== "string"
      || body.nome_responsavel.trim().length < 3 || body.nome_responsavel.trim().length > 150
      || typeof body.senha !== "string" || !body.senha || body.senha.length > 4096) {
      return reply(400, { erro: "Confira a mensagem, o nome e a senha." });
    }
    // O email vem da sessão validada, nunca do formulário.
    const verifier = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, options);
    const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password: body.senha });
    body.senha = "";
    if (error || data.user?.id !== user.id) {
      if (data.session) await verifier.auth.signOut({ scope: "local" });
      return reply(error?.status === 429 ? 429 : 403, {
        erro: error?.status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." : "Não foi possível confirmar a senha.",
      });
    }
    try {
      const { data: assinatura, error: rpcError } = await admin.rpc("registrar_assinatura_verificada", {
        p_usuario_id: user.id, p_mensagem_id: body.mensagem_id,
        p_nome_responsavel: body.nome_responsavel.trim(),
      });
      if (rpcError) return reply(rpcError.code === "42501" ? 403 : 400, {
        erro: ["42501", "22023"].includes(rpcError.code) ? rpcError.message : "Não foi possível registrar. Atualize a página para conferir antes de tentar novamente.",
      });
      if (!assinatura) return reply(500, { erro: "O banco não confirmou a assinatura." });
      return reply(200, { assinatura_id: assinatura });
    } finally {
      // Encerra apenas a sessão temporária criada para conferir a senha.
      await verifier.auth.signOut({ scope: "local" });
    }
  } catch {
    // Não registrar corpo, senha ou tokens nos logs.
    return reply(500, { erro: "Não foi possível confirmar. Atualize a página para conferir a assinatura." });
  }
});
