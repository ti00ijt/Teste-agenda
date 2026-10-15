import { supabase } from "./supabase.js?v=20261015-2";

const status = document.querySelector("#status-notificacoes");
const lista = document.querySelector("#lista-notificacoes");
const botoes = [...document.querySelectorAll("[data-notificacao]")];
let registro;
async function chamar(acao, dados = {}) {
  const { data, error } = await supabase.functions.invoke("notificacoes", { body: { acao, ...dados } });
  if (error) {
    let texto = "Não foi possível acessar as notificações. Confira a publicação da função notificacoes.";
    if (error.context instanceof Response) {
      const resposta = await error.context.json().catch(() => null);
      if (resposta?.erro) texto = resposta.erro;
    }
    throw new Error(texto);
  }
  return data;
}
function bytes(chave) {
  const limpa = typeof chave === "string" ? chave.trim() : "";
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(limpa)) {
    throw new Error("VAPID_PUBLIC_KEY inválida no Supabase. Copie o valor completo do campo público, não o privado. Não gere outro par se ainda possui o original.");
  }
  const dados = Uint8Array.from(atob(limpa.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(limpa.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  if (dados.length !== 65 || dados[0] !== 4) throw new Error("A chave pública VAPID não tem o formato esperado. Confira o secret VAPID_PUBLIC_KEY.");
  return dados;
}
async function historico() {
  const { notificacoes } = await chamar("listar");
  lista.replaceChildren();
  if (!notificacoes.length) {
    const item = document.createElement("li");
    item.textContent = "Nenhuma notificação por enquanto.";
    lista.append(item);
  }
  for (const notificacao of notificacoes) {
    const item = document.createElement("li");
    const texto = document.createElement("p");
    texto.textContent = `${notificacao.titulo} — ${new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
    }).format(new Date(notificacao.criado_em))}`;
    item.append(texto);
    if (!notificacao.visualizado_em) {
      const visto = document.createElement("button");
      visto.type = "button";
      visto.textContent = "Marcar como vista";
      visto.addEventListener("click", () => executar(async () => {
        await chamar("visualizar", { id: notificacao.id });
        await historico();
      }));
      item.append(visto);
    } else {
      item.append(document.createTextNode("Vista"));
    }
    lista.append(item);
  }
}
async function executar(acao) {
  botoes.forEach((b) => { b.disabled = true; });
  try { await acao(); } catch (erro) { status.textContent = erro.message; }
  finally { botoes.forEach((b) => { b.disabled = false; }); }
}
async function ativar() {
  if (!registro) throw new Error("Notificações indisponíveis neste navegador. No iPhone, adicione a agenda à tela inicial e abra pelo ícone.");
  // Solicita permissão diretamente a partir do clique, antes de chamadas de rede.
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Permissão não concedida. Você pode alterá-la nas configurações do navegador.");
  const { chave_publica } = await chamar("configurar");
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(chave_publica) });
  await chamar("registrar", { inscricao: inscricao.toJSON() });
  status.textContent = "Notificações ativadas neste aparelho. Você já pode enviar um teste.";
}
for (const botao of botoes) botao.addEventListener("click", () => executar(async () => {
  switch (botao.dataset.notificacao) {
    case "ativar": await ativar(); break;
    case "desativar": {
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        await chamar("remover", { endpoint: inscricao.endpoint });
        await inscricao.unsubscribe();
      }
      status.textContent = "Notificações desativadas neste aparelho.";
      break;
    }
    case "teste": {
      const inscricao = await registro?.pushManager.getSubscription();
      if (!inscricao) throw new Error("Ative as notificações neste aparelho primeiro.");
      const resposta = await chamar("teste", { endpoint: inscricao.endpoint });
      status.textContent = resposta.aceita
        ? "O serviço de push aceitou o teste. Confira as notificações do aparelho; isso não confirma leitura."
        : `Teste salvo no histórico, mas o envio ao aparelho falhou. ${resposta.diagnostico || "Tente desativar e ativar novamente as notificações."}`;
      await historico();
      break;
    }
    case "atualizar": await historico(); break;
  }
}));
async function iniciar() {
  if (window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    registro = await navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: new URL("../", import.meta.url).pathname });
    await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.getSubscription();
    if (inscricao && Notification.permission === "granted") {
      await chamar("registrar", { inscricao: inscricao.toJSON() });
      status.textContent = "Notificações ativadas neste aparelho.";
    } else status.textContent = "Ative as notificações para receber avisos neste aparelho.";
  } else status.textContent = "Neste navegador, consulte o histórico abaixo. No iPhone, adicione a agenda à tela inicial e abra pelo ícone.";
  await historico();
}
executar(iniciar);
