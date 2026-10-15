import { supabase } from "./supabase.js";

const lista = document.querySelector("#lista-avisos");
const mensagemLista = document.querySelector("#mensagem-lista-avisos");

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo"
});

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function criarAviso(aviso, assinatura, assinaturasDisponiveis) {
  const item = criarElemento("div", "bl-item");

  const blocoData = criarElemento("div", "bl-data");
  const data = document.createElement("time");

  data.dateTime = aviso.criado_em;
  data.textContent = formatoData.format(new Date(aviso.criado_em));

  blocoData.append(data, document.createElement("span"));

  const cartao = criarElemento("article", "bl-cartao");
  const tituloId = `aviso-${aviso.id}`;

  cartao.setAttribute("aria-labelledby", tituloId);

  const topo = criarElemento("div", "bl-cartao-topo");

  topo.append(
    criarElemento(
      "p",
      "bl-remetente",
      aviso.nome_remetente ?? "Remetente indisponível"
    )
  );

  const estado = !assinaturasDisponiveis ? "indisponivel" : assinatura ? "assinado" : "pendente";
  topo.append(criarElemento("span", `bl-status bl-status-${estado}`,
    !assinaturasDisponiveis ? "Assinatura não consultada" : assinatura ? "Assinado" : "Pendente"));

  const titulo = criarElemento("h2", "", aviso.titulo);
  titulo.id = tituloId;

  const blocoTexto = criarElemento("div", "bl-texto");
  const texto = criarElemento("p", "", aviso.conteudo);

  texto.style.whiteSpace = "pre-wrap";
  texto.style.overflowWrap = "anywhere";

  blocoTexto.append(texto);

  const rodape = criarElemento(
    "footer",
    "bl-assinatura",
    [
      aviso.nome_materia,
      aviso.nome_turma,
      "Colégio Global"
    ].filter(Boolean).join(" • ")
  );

  if (assinatura) {
    const confirmacao = criarElemento("p", "bl-confirmacao");
    confirmacao.append(document.createTextNode(`Assinado por ${assinatura.nome_responsavel} em `));
    const dataAssinatura = criarElemento("time");
    dataAssinatura.dateTime = assinatura.assinado_em;
    dataAssinatura.textContent = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
    }).format(new Date(assinatura.assinado_em));
    confirmacao.append(dataAssinatura);
    rodape.append(confirmacao);
  }
  const assinar = criarElemento("a", "bl-acao-assinatura",
    !assinaturasDisponiveis ? "Consultar assinatura" : assinatura ? "Ver assinatura" : "Assinar");
  assinar.href = `assinatura.html?mensagem=${encodeURIComponent(aviso.id)}&origem=aviso`;
  cartao.append(topo, titulo, blocoTexto, rodape, assinar);
  item.append(blocoData, cartao);

  return item;
}

async function carregarAvisos() {
  lista.replaceChildren();
  mensagemLista.textContent = "Carregando avisos...";

  try {
    const { data: avisos, error } = await supabase.rpc(
      "listar_mensagens_aluno",
      {
        p_tipo: "aviso"
      }
    );

    if (error) throw error;

    if (!Array.isArray(avisos)) {
      throw new Error("O banco não retornou a lista esperada.");
    }

    if (avisos.length === 0) {
      mensagemLista.textContent =
        "Nenhum aviso aprovado disponível para este aluno.";
      return;
    }

    // Uma consulta para todos os avisos, restrita à conta no banco.
    const { data: assinaturas, error: erroAssinaturas } = await supabase.rpc(
      "listar_assinaturas_aluno", { p_mensagem_ids: avisos.map((aviso) => aviso.id) }
    );
    const assinaturasDisponiveis = !erroAssinaturas && Array.isArray(assinaturas);
    const porMensagem = new Map(
      assinaturasDisponiveis ? assinaturas.map((assinatura) => [assinatura.mensagem_id, assinatura]) : []
    );
    const fragmento = document.createDocumentFragment();

    for (const aviso of avisos) {
      fragmento.append(criarAviso(aviso, porMensagem.get(aviso.id), assinaturasDisponiveis));
    }

    lista.append(fragmento);

    mensagemLista.textContent =
      `${avisos.length} aviso(s) exibido(s), do mais recente para o mais antigo. ` +
      "São exibidos até 50 avisos.";
    if (!assinaturasDisponiveis) {
      mensagemLista.textContent += " Não foi possível consultar as assinaturas. Atualize a página para tentar novamente.";
    }

  } catch (erro) {
    console.error("Erro ao carregar avisos:", erro);

    mensagemLista.textContent =
      erro.code === "42501"
        ? "Não foi possível acessar os avisos desta conta. Procure a secretaria."
        : "Não foi possível carregar os avisos. Atualize a página e tente novamente.";
  }
}

carregarAvisos();
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) carregarAvisos();
});
