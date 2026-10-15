import { supabase } from "./supabase.js";

const formulario = document.querySelector("#form-assinatura");
const campos = document.querySelector("#campos-assinatura");
const nome = document.querySelector("#nome-responsavel");
const senha = document.querySelector("#senha-responsavel");
const botao = document.querySelector("#confirmar-assinatura");
const resultado = document.querySelector("#resultado-assinatura");
const mensagemId = new URLSearchParams(location.search).get("mensagem");
const origem = new URLSearchParams(location.search).get("origem");
if (origem === "tarefa" || origem === "aviso") {
  for (const link of document.querySelectorAll(".assinatura-voltar, .assinatura-cancelar")) {
    link.href = origem === "aviso" ? "aviso.html" : "tarefa.html";
  }
}
let enviando = false;
let disponivel = false;

async function carregar() {
  campos.disabled = true;
  disponivel = false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mensagemId ?? "")) {
    resultado.textContent = "Volte à lista e selecione uma mensagem para assinar.";
    return;
  }
  const { data, error } = await supabase.rpc("consultar_mensagem_assinatura", { p_mensagem_id: mensagemId });
  if (error) throw new Error("Não foi possível consultar a assinatura. Atualize a página.");
  const mensagem = data?.[0];
  if (!mensagem) {
    resultado.textContent = "Esta mensagem não está disponível para esta conta.";
    return;
  }
  document.querySelector("#assinatura-assunto").textContent = mensagem.titulo;
  document.querySelector("#assinatura-conteudo").textContent = mensagem.conteudo;
  if (mensagem.assinado_em) {
    const dataAssinatura = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
    }).format(new Date(mensagem.assinado_em));
    resultado.textContent = `Assinado por ${mensagem.nome_responsavel} em ${dataAssinatura}.`;
    formulario.hidden = true;
    return;
  }
  formulario.hidden = false;
  disponivel = true;
  campos.disabled = false;
  resultado.textContent = "Informe seu nome e confirme a senha para assinar.";
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (enviando || !disponivel) return;
  nome.value = nome.value.trim();
  if (!formulario.reportValidity()) return;
  enviando = true;
  campos.disabled = true;
  botao.textContent = "Confirmando...";
  resultado.textContent = "Conferindo a senha e registrando a assinatura...";
  try {
    const { data, error } = await supabase.functions.invoke("assinar-mensagem", {
      body: { mensagem_id: mensagemId, nome_responsavel: nome.value, senha: senha.value },
    });
    if (error) {
      let texto = "Não foi possível confirmar. Atualize a página para conferir antes de tentar novamente.";
      if (error.context instanceof Response) {
        const status = error.context.status;
        const resposta = await error.context.json().catch(() => null);
        if (typeof resposta?.erro === "string") {
          texto = resposta.erro;
        } else if (status === 401) {
          texto = "A função recusou a autenticação. Confira se Verify JWT está desativado em assinar-mensagem no Supabase; depois saia e entre novamente na conta.";
        } else if (status === 404) {
          texto = "A função assinar-mensagem não foi encontrada. Confira o nome e a publicação no Supabase.";
        } else {
          texto = `O servidor retornou erro ${status}. Confira os logs da função assinar-mensagem no Supabase.`;
        }
      } else if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError") {
        texto = "Não foi possível acessar a função de assinatura. Confira sua conexão e se assinar-mensagem está publicada no Supabase.";
      }
      throw new Error(texto);
    }
    if (!data?.assinatura_id) throw new Error("O servidor não confirmou a assinatura. Atualize a página para conferir.");
    disponivel = false;
    formulario.hidden = true;
    resultado.textContent = "Assinatura registrada!";
    await carregar();
  } catch (erro) {
    resultado.textContent = erro.message || "Não foi possível confirmar a assinatura.";
  } finally {
    senha.value = "";
    enviando = false;
    campos.disabled = !disponivel;
    botao.textContent = "Assinar";
  }
});

window.addEventListener("pagehide", () => { senha.value = ""; });
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) carregar().catch((erro) => { resultado.textContent = erro.message; });
});
carregar().catch((erro) => { resultado.textContent = erro.message; });
