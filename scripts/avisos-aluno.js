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

function criarAviso(aviso) {
  const item = criarElemento("div", "bl-item");

  // Data na lateral do cartão.
  const blocoData = criarElemento("div", "bl-data");
  const data = document.createElement("time");

  data.dateTime = aviso.criado_em;
  data.textContent = formatoData.format(new Date(aviso.criado_em));

  blocoData.append(data, document.createElement("span"));

  // Conteúdo do cartão.
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

  const titulo = criarElemento("h2", "", aviso.titulo);
  titulo.id = tituloId;

  const blocoTexto = criarElemento("div", "bl-texto");
  const texto = criarElemento("p", "", aviso.conteudo);

  // Preserva as quebras de linha sem interpretar o texto como HTML.
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

  cartao.append(topo, titulo, blocoTexto, rodape);
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

    const fragmento = document.createDocumentFragment();

    for (const aviso of avisos) {
      fragmento.append(criarAviso(aviso));
    }

    lista.append(fragmento);

    mensagemLista.textContent =
      `${avisos.length} aviso(s) exibido(s), do mais recente para o mais antigo. ` +
      "São exibidos até 50 avisos.";

  } catch (erro) {
    console.error("Erro ao carregar avisos:", erro);

    mensagemLista.textContent =
      erro.code === "42501"
        ? "Não foi possível acessar os avisos desta conta. Procure a secretaria."
        : "Não foi possível carregar os avisos. Atualize a página e tente novamente.";
  }
}

carregarAvisos();