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
    if (!token) return reply(401, { erro: "Entre novamente na conta." });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply(401, { erro: "Entre novamente na conta." });
    const { data: perfil, error: perfilError } = await admin.from("perfis")
      .select("perfil, ativo").eq("id", user.id).maybeSingle();
    if (perfilError) {
      // Diagnóstico sem registrar sessão, senha ou dados do cadastro.
      console.error("Falha ao consultar perfil da coordenação", { codigo: perfilError.code });
      const codigo = perfilError.code || "sem_codigo";
      return reply(503, { erro: `Não foi possível conferir seu acesso (código: ${codigo}).` });
    }
    if (perfil?.perfil !== "coordenacao" || !perfil.ativo) {
      return reply(403, { erro: "Cadastro permitido somente à coordenação ativa." });
    }
    let body;
    try { body = await req.json(); } catch { return reply(400, { erro: "Dados inválidos." }); }
    if (!body || !["aluno", "professor"].includes(body.tipo)
      || typeof body.nome !== "string" || !body.nome.trim() || body.nome.length > 150
      || typeof body.identificador !== "string" || !body.identificador.trim() || body.identificador.length > 100
      || typeof body.senha !== "string" || body.senha.length < 8 || body.senha.length > 128) {
      return reply(400, { erro: "Preencha nome, RA ou código e uma senha de 8 a 128 caracteres." });
    }
    const identificador = body.identificador.trim();
    let email: string;
    if (body.tipo === "aluno") {
      if (!/^[a-z0-9._-]+$/i.test(identificador) || !uuid.test(body.turma_id ?? "")) {
        return reply(400, { erro: "Selecione a turma e informe um RA com letras, números, ponto, hífen ou sublinhado." });
      }
      email = `aluno.${identificador.toLowerCase()}@agenda.invalid`;
    } else {
      if (typeof body.email !== "string" || body.email.length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
        || !Array.isArray(body.materias) || !body.materias.length || body.materias.length > 100
        || !body.materias.every((id: unknown) => typeof id === "string" && uuid.test(id))) {
        return reply(400, { erro: "Informe um e-mail válido e selecione as matérias." });
      }
      email = body.email.trim().toLowerCase();
      if (email.endsWith("@agenda.invalid")) return reply(400, { erro: "Use o e-mail real do professor." });
    }
    // Não vincula automaticamente uma conta a um cadastro antigo.
    const { data: existente, error: consultaError } = await admin
      .from(body.tipo === "aluno" ? "alunos" : "professores")
      .select("id").eq(body.tipo === "aluno" ? "ra" : "codigo", identificador).limit(1);
    if (consultaError) return reply(503, { erro: "Não foi possível conferir cadastros existentes." });
    if (existente?.length) return reply(409, { erro: "Este RA ou código já está cadastrado. Não repita o cadastro; o acesso existente precisa ser conferido." });

    // Somente cria contas pelo Admin Auth; a sessão da coordenação é preservada.
    const { data: criada, error: criarError } = await admin.auth.admin.createUser({
      email, password: body.senha, email_confirm: true,
    });
    body.senha = "";
    if (criarError || !criada.user) {
      const duplicado = ["email_exists", "user_already_exists"].includes(criarError?.code ?? "");
      return reply(duplicado ? 409 : 400, { erro: duplicado
        ? "Já existe uma conta com este acesso. Confira no Supabase antes de repetir."
        : "Não foi possível criar a conta. Confira a política de senha do Supabase e os dados informados.",
      });
    }
    const usuarioId = criada.user.id;
    let finalizacao;
    try {
      finalizacao = await admin.rpc("finalizar_cadastro_com_acesso", {
        p_coordenacao_id: user.id, p_usuario_id: usuarioId,
        p_tipo: body.tipo, p_nome: body.nome.trim(), p_identificador: identificador,
        p_turma_id: body.tipo === "aluno" ? body.turma_id : null,
        p_materias: body.tipo === "professor" ? body.materias : null,
      });
    } catch {
      // Resposta perdida pode significar que o cadastro foi concluído.
      return reply(503, { erro: "A conta foi criada, mas não foi possível confirmar o cadastro. Confira Auth, perfis e o cadastro no Supabase antes de repetir.", usuario_id: usuarioId });
    }
    if (finalizacao.error) {
      const erro = finalizacao.error;
      // Só desfaz a conta recém-criada quando o banco confirmou rejeição/rollback.
      const rejeicaoConfirmada = /^(22|23|42)/.test(erro.code)
        || ["P0001", "PGRST202"].includes(erro.code);
      if (rejeicaoConfirmada) {
        const { error: apagarError } = await admin.auth.admin.deleteUser(usuarioId);
        if (!apagarError) return reply(400, { erro: erro.code === "23505"
          ? "RA ou código já cadastrado. A nova conta foi desfeita."
          : ["22023", "42501"].includes(erro.code) ? erro.message
          : "O banco recusou o cadastro. A nova conta foi desfeita; confira se a função SQL foi instalada.",
        });
      }
      return reply(503, { erro: "Não foi possível confirmar a finalização. Confira a conta e o cadastro no Supabase antes de repetir.", usuario_id: usuarioId });
    }
    if (!finalizacao.data) return reply(503, { erro: "O banco não retornou a confirmação. Confira a conta e o cadastro antes de repetir.", usuario_id: usuarioId });
    return reply(200, { cadastro_id: finalizacao.data, usuario_id: usuarioId, login: body.tipo === "aluno" ? identificador : email });
  } catch {
    // Nunca registrar senha, token ou corpo da requisição nos logs.
    return reply(500, { erro: "Não foi possível confirmar o cadastro. Confira Auth e o cadastro no Supabase antes de repetir." });
  }
});
