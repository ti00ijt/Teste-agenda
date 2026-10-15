import { supabase } from "./supabase.js?v=20261015-2";

const lista = document.querySelector("#lista-bilhetes");
const mensagemLista = document.querySelector("#mensagem-lista-bilhetes");

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

function criarBilhete(bilhete, assinatura, assinaturasDisponiveis) {
  const item = criarElemento("div", "bl-item");

  const blocoData = criarElemento("div", "bl-data");
  const data = document.createElement("time");

  data.dateTime = bilhete.criado_em;
  data.textContent = formatoData.format(new Date(bilhete.criado_em));

  blocoData.append(data, document.createElement("span"));

  const cartao = criarElemento("article", "bl-cartao");
  const tituloId = `bilhete-${bilhete.id}`;

  cartao.setAttribute("aria-labelledby", tituloId);

  const topo = criarElemento("div", "bl-cartao-topo");

  topo.append(
    criarElemento(
      "p",
      "bl-remetente",
      bilhete.nome_remetente ?? "Remetente indisponível"
    )
  );

  const estado = !assinaturasDisponiveis ? "indisponivel" : assinatura ? "assinado" : "pendente";
  topo.append(criarElemento("span", `bl-status bl-status-${estado}`,
    !assinaturasDisponiveis ? "Assinatura não consultada" : assinatura ? "Assinado" : "Pendente"));

  const titulo = criarElemento("h2", "", bilhete.titulo);
  titulo.id = tituloId;

  const blocoTexto = criarElemento("div", "bl-texto");
  const texto = criarElemento("p", "", bilhete.conteudo);

  texto.style.whiteSpace = "pre-wrap";
  texto.style.overflowWrap = "anywhere";

  blocoTexto.append(texto);

  const rodape = criarElemento(
    "footer",
    "bl-assinatura",
    [
      bilhete.nome_materia,
      bilhete.nome_turma,
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
  assinar.href = `assinatura.html?mensagem=${encodeURIComponent(bilhete.id)}`;
  cartao.append(topo, titulo, blocoTexto, rodape, assinar);
  item.append(blocoData, cartao);

  return item;
}

async function carregarBilhetes() {
  lista.replaceChildren();
  mensagemLista.textContent = "Carregando bilhetes...";

  try {
    const { data: bilhetes, error } = await supabase.rpc(
      "listar_mensagens_aluno",
      {
        p_tipo: "bilhete"
      }
    );

    if (error) throw error;

    if (!Array.isArray(bilhetes)) {
      throw new Error("O banco não retornou a lista esperada.");
    }

    if (bilhetes.length === 0) {
      mensagemLista.textContent =
        "Nenhum bilhete aprovado disponível para este aluno.";
      return;
    }

    // Uma consulta para todos os bilhetes, restrita à conta no banco.
    const { data: assinaturas, error: erroAssinaturas } = await supabase.rpc(
      "listar_assinaturas_aluno", { p_mensagem_ids: bilhetes.map((bilhete) => bilhete.id) }
    );
    const assinaturasDisponiveis = !erroAssinaturas && Array.isArray(assinaturas);
    const porMensagem = new Map(
      assinaturasDisponiveis ? assinaturas.map((assinatura) => [assinatura.mensagem_id, assinatura]) : []
    );
    const fragmento = document.createDocumentFragment();

    for (const bilhete of bilhetes) {
      fragmento.append(criarBilhete(bilhete, porMensagem.get(bilhete.id), assinaturasDisponiveis));
    }

    lista.append(fragmento);

    mensagemLista.textContent =
      `${bilhetes.length} bilhete(s) exibido(s), do mais recente para o mais antigo. ` +
      "São exibidos até 50 bilhetes.";
    if (!assinaturasDisponiveis) {
      mensagemLista.textContent += " Não foi possível consultar as assinaturas. Atualize a página para tentar novamente.";
    }

  } catch (erro) {
    console.error("Erro ao carregar bilhetes:", erro);

    mensagemLista.textContent =
      erro.code === "42501"
        ? "Não foi possível acessar os bilhetes desta conta. Procure a secretaria."
        : "Não foi possível carregar os bilhetes. Atualize a página e tente novamente.";
  }
}

carregarBilhetes();
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) carregarBilhetes();
});
