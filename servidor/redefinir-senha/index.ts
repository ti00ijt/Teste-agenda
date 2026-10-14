import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { erro: "Método não permitido." });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { erro: "Entre novamente na conta da coordenação." });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply(401, { erro: "Entre novamente na conta da coordenação." });
    const { data: coordenacao, error: coordError } = await admin.from("perfis")
      .select("perfil, ativo").eq("id", user.id).maybeSingle();
    if (coordError) return reply(503, { erro: "Não foi possível conferir seu acesso." });
    if (coordenacao?.perfil !== "coordenacao" || !coordenacao.ativo) {
      return reply(403, { erro: "Somente a coordenação ativa pode redefinir senhas." });
    }
    let body;
    try { body = await req.json(); } catch { return reply(400, { erro: "Dados inválidos." }); }
    if (!body || !["aluno", "professor"].includes(body.tipo)
      || typeof body.cadastro_id !== "string" || !uuid.test(body.cadastro_id)
      || typeof body.senha !== "string" || body.senha.length < 8 || body.senha.length > 128) {
      return reply(400, { erro: "Selecione o cadastro e informe uma senha de 8 a 128 caracteres." });
    }
    // O vínculo vem do banco, não de um usuario_id fornecido pelo navegador.
    const { data: cadastro, error: cadastroError } = await admin
      .from(body.tipo === "aluno" ? "alunos" : "professores")
      .select("usuario_id").eq("id", body.cadastro_id).maybeSingle();
    if (cadastroError) return reply(503, { erro: "Não foi possível consultar o cadastro." });
    if (!cadastro) return reply(404, { erro: "Cadastro não encontrado." });
    if (!cadastro.usuario_id) return reply(409, {
      erro: "Este cadastro ainda não tem conta de acesso vinculada. É preciso criar o acesso antes de redefinir a senha.",
    });
    const { data: destino, error: destinoError } = await admin.from("perfis")
      .select("perfil, ativo").eq("id", cadastro.usuario_id).maybeSingle();
    if (destinoError) return reply(503, { erro: "Não foi possível conferir a conta vinculada." });
    if (!destino?.ativo || destino.perfil !== body.tipo || cadastro.usuario_id === user.id) {
      return reply(403, { erro: "A conta vinculada não possui o perfil ativo esperado. Procure a administração." });
    }
    const { error } = await admin.auth.admin.updateUserById(cadastro.usuario_id, { password: body.senha });
    body.senha = "";
    if (error) {
      if (error.code === "weak_password") return reply(400, { erro: "A senha não atende à política de segurança do Supabase. Escolha uma senha mais forte." });
      if (error.code === "same_password") return reply(400, { erro: "Escolha uma senha diferente da atual." });
      if (error.status === 404) return reply(409, { erro: "A conta vinculada não foi encontrada no Auth. Confira o cadastro." });
      return reply(503, { erro: "Não foi possível confirmar a alteração. Teste a nova senha antes de tentar novamente." });
    }
    return reply(200, { sucesso: true });
  } catch {
    // Não registrar senhas, tokens ou corpo da requisição.
    return reply(503, { erro: "Não foi possível confirmar a alteração. Teste a nova senha antes de tentar novamente." });
  }
});
