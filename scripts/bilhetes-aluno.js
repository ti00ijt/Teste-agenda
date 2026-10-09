import { supabase } from "./supabase.js";

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

function criarBilhete(bilhete) {
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

  cartao.append(topo, titulo, blocoTexto, rodape);
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

    const fragmento = document.createDocumentFragment();

    for (const bilhete of bilhetes) {
      fragmento.append(criarBilhete(bilhete));
    }

    lista.append(fragmento);

    mensagemLista.textContent =
      `${bilhetes.length} bilhete(s) exibido(s), do mais recente para o mais antigo. ` +
      "São exibidos até 50 bilhetes.";

  } catch (erro) {
    console.error("Erro ao carregar bilhetes:", erro);

    mensagemLista.textContent =
      erro.code === "42501"
        ? "Não foi possível acessar os bilhetes desta conta. Procure a secretaria."
        : "Não foi possível carregar os bilhetes. Atualize a página e tente novamente.";
  }
}

carregarBilhetes();