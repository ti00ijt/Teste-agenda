import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
// Somente serviços de push conhecidos; não permite URLs arbitrárias/SSRF.
function endpointValido(endpoint: unknown) {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443")
      && (u.hostname === "fcm.googleapis.com" || u.hostname === "updates.push.services.mozilla.com"
        || u.hostname === "web.push.apple.com" || u.hostname.endsWith(".push.apple.com")
        || u.hostname === "wns.windows.com" || u.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { erro: "Método não permitido." });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { erro: "Entre na conta para acessar as notificações." });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return reply(401, { erro: "Entre novamente na conta." });
    const { data: perfil, error: perfilError } = await db.from("perfis").select("perfil,ativo").eq("id", user.id).maybeSingle();
    if (perfilError) return reply(503, { erro: "Não foi possível conferir seu acesso." });
    if (!perfil?.ativo || perfil.perfil !== "aluno") return reply(403, { erro: "Recurso disponível para contas de aluno ativas." });
    const b = await req.json();
    if (!b || typeof b.acao !== "string") return reply(400, { erro: "Ação inválida." });
    if (b.acao === "configurar") {
      const chave = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
      if (!chave || !Deno.env.get("VAPID_PRIVATE_KEY")) return reply(503, { erro: "As chaves de notificações ainda não foram configuradas no servidor." });
      try {
        if (!/^[A-Za-z0-9_-]{87}=?$/.test(chave)) throw new Error("Formato inválido");
        const dados = Uint8Array.from(atob(chave.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(chave.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
        if (dados.length !== 65 || dados[0] !== 4) throw new Error("Formato inválido");
        await crypto.subtle.importKey("raw", dados, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      } catch {
        return reply(503, { erro: "VAPID_PUBLIC_KEY inválida. Confira se o secret contém o valor completo da chave pública, e não o nome do campo ou a chave privada." });
      }
      return reply(200, { chave_publica: chave });
    }
    if (b.acao === "listar") {
      const { data, error } = await db.from("notificacoes").select("id,titulo,criado_em,visualizado_em").eq("usuario_id", user.id).order("criado_em", { ascending: false }).limit(50);
      if (error) throw error;
      return reply(200, { notificacoes: data });
    }
    if (b.acao === "visualizar") {
      if (typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return reply(400, { erro: "Notificação inválida." });
      const { error } = await db.from("notificacoes").update({ visualizado_em: new Date().toISOString() }).eq("id", b.id).eq("usuario_id", user.id).is("visualizado_em", null);
      if (error) throw error;
      return reply(200, { sucesso: true });
    }
    if (b.acao === "registrar") {
      const s = b.inscricao;
      if (!endpointValido(s?.endpoint) || typeof s?.keys?.p256dh !== "string" || !/^[A-Za-z0-9_-]{87}=?$/.test(s.keys.p256dh)
        || typeof s?.keys?.auth !== "string" || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth)) return reply(400, { erro: "Inscrição inválida ou navegador ainda não suportado pelo teste." });
      const { data: anterior, error: anteriorError } = await db.from("notificacao_aparelhos")
        .select("p256dh,auth").eq("endpoint", s.endpoint).maybeSingle();
      if (anteriorError) throw anteriorError;
      if (anterior && (anterior.p256dh !== s.keys.p256dh || anterior.auth !== s.keys.auth)) {
        return reply(409, { erro: "Inscrição divergente. Desative as notificações no navegador e ative novamente." });
      }
      const { error } = await db.from("notificacao_aparelhos").upsert({ endpoint: s.endpoint, usuario_id: user.id, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply(200, { sucesso: true });
    }
    if (b.acao === "remover") {
      if (!endpointValido(b.endpoint)) return reply(400, { erro: "Aparelho inválido." });
      const { error } = await db.from("notificacao_aparelhos").delete().eq("endpoint", b.endpoint).eq("usuario_id", user.id);
      if (error) throw error;
      return reply(200, { sucesso: true });
    }
    if (b.acao === "teste") {
      if (!Deno.env.get("VAPID_PUBLIC_KEY") || !Deno.env.get("VAPID_PRIVATE_KEY")) {
        return reply(503, { erro: "Configure as chaves VAPID no servidor antes de testar." });
      }
      if (!endpointValido(b.endpoint)) return reply(400, { erro: "Aparelho inválido." });
      const { data: s, error: sError } = await db.from("notificacao_aparelhos").select("endpoint,p256dh,auth").eq("endpoint", b.endpoint).eq("usuario_id", user.id).maybeSingle();
      if (sError) throw sError;
      if (!s) return reply(409, { erro: "Ative as notificações neste aparelho primeiro." });
      // A RPC limita testes a um por minuto por conta e salva o histórico.
      const { data: id, error: testeError } = await db.rpc("criar_notificacao_teste", { p_usuario_id: user.id });
      if (testeError) return reply(429, { erro: testeError.code === "22023" ? testeError.message : "Não foi possível registrar o teste." });
      let aceita = false;
      let diagnostico = "";
      try {
        const detalhes = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, null, {
          vapidDetails: { subject: "https://ti00ijt.github.io/Teste-agenda/", publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!.trim(), privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!.trim() }, TTL: 300,
        });
        const resposta = await fetch(detalhes.endpoint, { method: "POST", headers: detalhes.headers, redirect: "error", signal: AbortSignal.timeout(10000) });
        aceita = resposta.ok;
        if (!aceita) {
          console.error("Serviço de push recusou o teste", { status: resposta.status });
          diagnostico = [401, 403].includes(resposta.status)
            ? `O serviço recusou a autenticação (HTTP ${resposta.status}). Confira se as chaves VAPID são do mesmo par; se foram trocadas, desative e ative novamente neste aparelho.`
            : [404, 410].includes(resposta.status)
            ? "A inscrição do aparelho expirou. Desative e ative novamente as notificações."
            : `O serviço de push retornou HTTP ${resposta.status}.`;
        }
        await resposta.body?.cancel();
        if ([404,410].includes(resposta.status)) await db.from("notificacao_aparelhos").delete().eq("endpoint", s.endpoint).eq("usuario_id", user.id);
      } catch (erro) {
        // Não registrar endpoint, headers, chaves ou o objeto completo do erro.
        const nome = erro instanceof Error ? erro.name : "erro";
        console.error("Falha ao preparar ou enviar push", { tipo: nome });
        diagnostico = nome === "TimeoutError" || nome === "AbortError"
          ? "A conexão com o serviço de push excedeu o tempo limite. Tente novamente em um minuto."
          : "Falha na preparação ou conexão do push. Confira o par de chaves VAPID e os logs da função notificacoes.";
      }
      const { error: salvarError } = await db.from("notificacoes").update({ push_estado: aceita ? "aceito" : "falhou" }).eq("id", id).eq("usuario_id", user.id);
      if (salvarError) throw salvarError;
      return reply(200, { aceita, diagnostico });
    }
    return reply(400, { erro: "Ação inválida." });
  } catch { return reply(503, { erro: "Não foi possível concluir. Confira as tabelas e a configuração das notificações." }); }
});
