import { supabase } from "./supabase.js";

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

export function criarConsultaAssinaturas(mensagemId, rpc = "consultar_assinaturas_coordenacao") {
  const painel = criarElemento("details", "histgeral-assinaturas");
  painel.append(criarElemento("summary", "", "Consultar assinaturas"));
  const resultado = criarElemento("p", "", "Abra para consultar os destinatários desta mensagem.");
  resultado.setAttribute("role", "status");
  resultado.setAttribute("aria-live", "polite");
  const atualizar = criarElemento("button", "histgeral-atualizar", "Atualizar assinaturas");
  atualizar.type = "button";
  const rolagem = criarElemento("div", "histgeral-assinaturas-rolagem");
  rolagem.tabIndex = 0;
  rolagem.setAttribute("role", "region");
  rolagem.setAttribute("aria-label", "Assinaturas dos destinatários");
  painel.append(resultado, atualizar, rolagem);
  let carregando = false;
  let carregado = false;
  async function consultar() {
    if (carregando) return;
    carregando = true;
    atualizar.disabled = true;
    rolagem.replaceChildren();
    resultado.textContent = "Consultando assinaturas...";
    try {
      const { data, error } = await supabase.rpc(rpc, {
        p_mensagem_id: mensagemId,
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Resposta inválida.");
      const assinados = data.filter((aluno) => aluno.assinado_em).length;
      resultado.textContent = data.length
        ? `${data.length} destinatário(s): ${assinados} assinado(s) e ${data.length - assinados} pendente(s).`
        : "Nenhum destinatário registrado para esta mensagem.";
      if (data.length) {
        const tabela = document.createElement("table");
        const legenda = criarElemento("caption", "", "Assinaturas por aluno destinatário");
        const cabecalho = document.createElement("thead");
        const linha = document.createElement("tr");
        for (const titulo of ["Aluno", "RA", "Situação", "Responsável", "Data da assinatura"]) {
          const coluna = criarElemento("th", "", titulo);
          coluna.scope = "col";
          linha.append(coluna);
        }
        cabecalho.append(linha);
        const corpo = document.createElement("tbody");
        for (const aluno of data) {
          const linhaAluno = document.createElement("tr");
          for (const valor of [aluno.nome_aluno, aluno.ra ?? "—",
            aluno.assinado_em ? "Assinado" : "Pendente",
            aluno.nome_responsavel ?? "—",
            aluno.assinado_em ? formatoData.format(new Date(aluno.assinado_em)) : "—"]) {
            linhaAluno.append(criarElemento("td", "", valor));
          }
          corpo.append(linhaAluno);
        }
        tabela.append(legenda, cabecalho, corpo);
        rolagem.append(tabela);
      }
      carregado = true;
    } catch (erro) {
      carregado = false;
      resultado.textContent = erro.code === "42501"
        ? "Acesso não autorizado para consultar esta mensagem."
        : "Não foi possível consultar as assinaturas. Clique em Atualizar assinaturas para tentar novamente.";
    } finally {
      carregando = false;
      atualizar.disabled = false;
    }
  }
  painel.addEventListener("toggle", () => {
    if (painel.open && !carregado) consultar();
  });
  atualizar.addEventListener("click", consultar);
  return painel;
}
