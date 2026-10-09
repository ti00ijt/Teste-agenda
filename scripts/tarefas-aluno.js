import { supabase } from "./supabase.js";

const lista = document.querySelector("#lista-tarefas");
const mensagemLista = document.querySelector("#mensagem-lista-tarefas");

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

function criarTarefa(tarefa) {
  const item = criarElemento("div", "bl-item");

  // Data em que a mensagem foi enviada.
  const blocoData = criarElemento("div", "bl-data");
  const data = document.createElement("time");

  data.dateTime = tarefa.criado_em;
  data.textContent = formatoData.format(new Date(tarefa.criado_em));

  blocoData.append(data, document.createElement("span"));

  const cartao = criarElemento("article", "bl-cartao");
  const tituloId = `tarefa-${tarefa.id}`;

  cartao.setAttribute("aria-labelledby", tituloId);

  const topo = criarElemento("div", "bl-cartao-topo");

  topo.append(
    criarElemento(
      "p",
      "bl-remetente",
      tarefa.nome_remetente ?? "Remetente indisponível"
    )
  );

  const titulo = criarElemento("h2", "", tarefa.titulo);
  titulo.id = tituloId;

  // O prazo é uma data sem horário.
  const prazo = criarElemento("p", "bl-prazo");

  if (tarefa.prazo) {
    const [ano, mes, dia] = tarefa.prazo.split("-");
    const dataPrazo = document.createElement("time");

    dataPrazo.dateTime = tarefa.prazo;
    dataPrazo.textContent = `${dia}/${mes}/${ano}`;

    prazo.append(
      criarElemento("strong", "", "Prazo de entrega: "),
      dataPrazo
    );
  } else {
    prazo.textContent = "Prazo de entrega não informado.";
  }

  const blocoTexto = criarElemento("div", "bl-texto");
  const texto = criarElemento("p", "", tarefa.conteudo);

  texto.style.whiteSpace = "pre-wrap";
  texto.style.overflowWrap = "anywhere";

  blocoTexto.append(texto);

  const rodape = criarElemento(
    "footer",
    "bl-assinatura",
    [
      tarefa.nome_materia,
      tarefa.nome_turma,
      "Colégio Global"
    ].filter(Boolean).join(" • ")
  );

  cartao.append(topo, titulo, prazo, blocoTexto, rodape);
  item.append(blocoData, cartao);

  return item;
}

async function carregarTarefas() {
  lista.replaceChildren();
  mensagemLista.textContent = "Carregando tarefas...";

  try {
    const { data: tarefas, error } = await supabase.rpc(
      "listar_mensagens_aluno",
      {
        p_tipo: "tarefa"
      }
    );

    if (error) throw error;

    if (!Array.isArray(tarefas)) {
      throw new Error("O banco não retornou a lista esperada.");
    }

    if (tarefas.length === 0) {
      mensagemLista.textContent =
        "Nenhuma tarefa aprovada disponível para este aluno.";
      return;
    }

    const fragmento = document.createDocumentFragment();

    for (const tarefa of tarefas) {
      fragmento.append(criarTarefa(tarefa));
    }

    lista.append(fragmento);

    mensagemLista.textContent =
      `${tarefas.length} tarefa(s) exibida(s), da mais recente para a mais antiga. ` +
      "São exibidas até 50 tarefas.";

  } catch (erro) {
    console.error("Erro ao carregar tarefas:", erro);

    mensagemLista.textContent =
      erro.code === "42501"
        ? "Não foi possível acessar as tarefas desta conta. Procure a secretaria."
        : "Não foi possível carregar as tarefas. Atualize a página e tente novamente.";
  }
}

carregarTarefas();
