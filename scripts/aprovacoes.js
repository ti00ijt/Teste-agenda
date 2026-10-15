import { supabase } from "./supabase.js";

const titulo = document.querySelector("#titulo-aprovacoes");
const descricao = document.querySelector("#descricao-aprovacoes");
const lista = document.querySelector("#lista-mensagens-pendentes");
const mensagem = document.querySelector("#mensagem-lista-pendentes");
const quantidade = document.querySelector("#quantidade-pendentes");

const categorias = {
  tarefa: "Tarefas",
  aviso: "Avisos",
  bilhete: "Bilhetes"
};

const parametros = new URLSearchParams(window.location.search);
const tipo = parametros.get("tipo");

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo"
});

// Usa textContent para exibir os textos com segurança.
function criarCelula(texto) {
  const celula = document.createElement("td");
  celula.textContent = texto;
  return celula;
}

async function carregarPendentes() {
  if (!Object.hasOwn(categorias, tipo)) {
    titulo.textContent = "Categoria inválida";
    mensagem.textContent =
      "Volte para a coordenação e selecione Tarefa, Aviso ou Bilhete.";
    quantidade.textContent = "—";
    return;
  }

  titulo.textContent = `${categorias[tipo]} para aprovação`;

  descricao.textContent =
    "Confira as mensagens encaminhadas pelos professores.";

  mensagem.textContent = "Carregando mensagens...";
  lista.replaceChildren();

  try {
    const { data: mensagens, error } = await supabase
      .from("mensagens")
      .select(`
        id,
        criado_em,
        titulo,
        conteudo,
        destino,
        vinculo:professor_materia_turmas (
          turma:turmas (
            nome,
            ano_letivo
          ),
          professor_materia:professor_materias (
            professor:professores (
              nome
            ),
            materia:materias (
              nome
            )
          )
        )
      `)
      .eq("status", "aguardando")
      .eq("tipo", tipo)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    if (error) throw error;

    quantidade.textContent =
      `${mensagens.length} mensagem(ns) exibida(s)`;

    if (mensagens.length === 0) {
      mensagem.textContent =
        "Nenhuma mensagem aguardando aprovação nesta categoria.";
      return;
    }

    const fragmento = document.createDocumentFragment();

    for (const registro of mensagens) {
      const linha = document.createElement("tr");

      const vinculo = registro.vinculo;
      const turma = vinculo?.turma;
      const professorMateria = vinculo?.professor_materia;

      const nomeProfessor =
        professorMateria?.professor?.nome ??
        "Professor indisponível";

      const nomeMateria =
        professorMateria?.materia?.nome ??
        "Matéria indisponível";

      const nomeTurma = turma
        ? `${turma.nome} — ${turma.ano_letivo}`
        : "Turma indisponível";

      const celulaData = document.createElement("td");
      const data = document.createElement("time");

      data.dateTime = registro.criado_em;
      data.textContent = formatoData.format(
        new Date(registro.criado_em)
      );

      celulaData.append(data);

      const celulaTurma = document.createElement("td");
      const identificacaoTurma = document.createElement("strong");
      const identificacaoMateria = document.createElement("p");

      identificacaoTurma.textContent = nomeTurma;
      identificacaoMateria.textContent = nomeMateria;

      celulaTurma.append(
        identificacaoTurma,
        identificacaoMateria
      );

      const celulaMensagem = document.createElement("td");
      const assunto = document.createElement("strong");
      const conteudo = document.createElement("p");

      assunto.className = "turma-assunto";
      assunto.textContent = registro.titulo;

      conteudo.textContent = registro.conteudo;
      conteudo.style.whiteSpace = "pre-wrap";
      conteudo.style.overflowWrap = "anywhere";

      celulaMensagem.append(assunto, conteudo);

      const destinatario =
        registro.destino === "geral"
          ? "Toda a turma"
          : "Alunos selecionados";

     const celulaAcao = document.createElement("td");
        const botaoAnalisar = document.createElement("button");

        botaoAnalisar.type = "button";
        botaoAnalisar.className = "envio-botao";
        botaoAnalisar.textContent = "Analisar";

        botaoAnalisar.addEventListener("click", () => {
        const dialogo = document.querySelector("#dialogo-analise");

        // Guarda qual mensagem está sendo analisada.
        dialogo.dataset.mensagemId = registro.id;

        document.querySelector("#analise-identificacao").textContent =
            `${nomeProfessor} • ${nomeTurma} • ${nomeMateria} • ${destinatario}`;

        document.querySelector("#analise-assunto").textContent =
            registro.titulo;

        document.querySelector("#analise-conteudo").textContent =
            registro.conteudo;
        prepararEdicao(registro);

        dialogo.showModal();
        });

        celulaAcao.append(botaoAnalisar);

        linha.append(
        celulaData,
        criarCelula(nomeProfessor),
        celulaTurma,
        criarCelula(destinatario),
        celulaMensagem,
        celulaAcao
        );
    

      fragmento.append(linha);
    }

    lista.append(fragmento);

    mensagem.textContent =
      "Exibindo até 50 mensagens pendentes, da mais recente para a mais antiga.";

  } catch (erro) {
    console.error("Erro ao carregar mensagens pendentes:", erro);

    lista.replaceChildren();
    quantidade.textContent = "—";

    mensagem.textContent =
      "Não foi possível carregar as mensagens. Confira o Console.";
  }
}

carregarPendentes();
const dialogoAnalise = document.querySelector("#dialogo-analise");
const resultadoAnalise = document.querySelector("#resultado-analise");
const botaoAprovar = document.querySelector("#aprovar-mensagem");
const botaoReprovar = document.querySelector("#reprovar-mensagem");
const botaoFechar = document.querySelector("#fechar-analise");

let analisando = false;

// Evita fechar pelo Esc enquanto a decisão está sendo enviada.
dialogoAnalise.addEventListener("cancel", (evento) => {
  if (analisando) {
    evento.preventDefault();
  }
});

async function registrarDecisao(decisao) {
  if (analisando || editando) return;

  const mensagemId = dialogoAnalise.dataset.mensagemId;

  if (!mensagemId) {
    resultadoAnalise.textContent =
      "Feche esta janela e abra a mensagem novamente.";
    return;
  }

  const acao = decisao === "aprovado" ? "aprovar" : "reprovar";

  const confirmou = window.confirm(
    `Deseja ${acao} esta mensagem?`
  );

  if (!confirmou) return;

  analisando = true;
  atualizarControlesAnalise();
  botaoAprovar.disabled = true;
  botaoReprovar.disabled = true;
  botaoFechar.disabled = true;

  resultadoAnalise.textContent = "Registrando decisão...";

  try {
    const { data, error } = await supabase.rpc(
    "analisar_mensagem_coordenacao",
    {
        p_mensagem_id: mensagemId,
        p_decisao: decisao,
        p_titulo_revisado: textoOriginal.titulo,
        p_conteudo_revisado: textoOriginal.conteudo
    }
    );
    if (error) throw error;

    if (!data) {
      throw new Error("O banco não confirmou a decisão.");
    }

    dialogoAnalise.close();

    // Busca novamente: a mensagem analisada sai da lista de pendentes.
    await carregarPendentes();

  } catch (erro) {
    console.error("Erro ao analisar mensagem:", erro);

    if (erro.code === "42501") {
      resultadoAnalise.textContent =
        "Ação não autorizada. Confira seu acesso de coordenação.";

    } else if (erro.code === "22023") {
      resultadoAnalise.textContent = erro.message;

      // A lista pode estar desatualizada se outra pessoa já analisou.
      await carregarPendentes();

    } else {
      resultadoAnalise.textContent =
        "Não foi possível confirmar a decisão. Feche esta janela e " +
        "atualize a página para conferir o status antes de tentar novamente.";
    }

  } finally {
    analisando = false;
    botaoAprovar.disabled = false;
    botaoReprovar.disabled = false;
    botaoFechar.disabled = false;
    atualizarControlesAnalise();
  }
}

botaoAprovar.addEventListener("click", () => {
  registrarDecisao("aprovado");
});

botaoReprovar.addEventListener("click", () => {
  registrarDecisao("reprovado");
});
const botaoEditar = document.querySelector("#editar-mensagem");
const botaoSalvarEdicao = document.querySelector("#salvar-edicao");
const botaoCancelarEdicao = document.querySelector("#cancelar-edicao");

const grupoEdicao = document.querySelector("#analise-edicao");
const visualizacao = document.querySelector("#analise-visualizacao");

const campoTituloEdicao = document.querySelector("#editar-titulo");
const campoConteudoEdicao = document.querySelector("#editar-conteudo");

let editando = false;
let textoOriginal = null;

function atualizarControlesAnalise() {
  botaoEditar.disabled =
    analisando || editando || !textoOriginal;

  botaoAprovar.disabled = analisando || editando;
  botaoReprovar.disabled = analisando || editando;
  botaoFechar.disabled = analisando;

  grupoEdicao.disabled = analisando || !editando;

  botaoSalvarEdicao.disabled = analisando;
  botaoCancelarEdicao.disabled = analisando;
}

// Executada sempre que uma mensagem é aberta.
function prepararEdicao(registro) {
  textoOriginal = {
    id: registro.id,
    titulo: registro.titulo,
    conteudo: registro.conteudo
  };

  editando = false;

  grupoEdicao.hidden = true;
  visualizacao.hidden = false;

  resultadoAnalise.textContent = "";

  atualizarControlesAnalise();
}

botaoEditar.addEventListener("click", () => {
  if (analisando || !textoOriginal) return;

  campoTituloEdicao.value = textoOriginal.titulo;
  campoConteudoEdicao.value = textoOriginal.conteudo;

  editando = true;

  visualizacao.hidden = true;
  grupoEdicao.hidden = false;

  resultadoAnalise.textContent = "";

  atualizarControlesAnalise();
  campoTituloEdicao.focus();
});

botaoCancelarEdicao.addEventListener("click", () => {
  if (analisando) return;

  editando = false;

  grupoEdicao.hidden = true;
  visualizacao.hidden = false;

  resultadoAnalise.textContent =
    "Edição cancelada. Nenhuma alteração foi salva.";

  atualizarControlesAnalise();
  botaoEditar.focus();
});

botaoSalvarEdicao.addEventListener("click", async () => {
  if (analisando || !editando || !textoOriginal) return;

  campoTituloEdicao.value = campoTituloEdicao.value.trim();
  campoConteudoEdicao.value = campoConteudoEdicao.value.trim();

  if (!campoTituloEdicao.reportValidity()) return;
  if (!campoConteudoEdicao.reportValidity()) return;

  const novoTitulo = campoTituloEdicao.value;
  const novoConteudo = campoConteudoEdicao.value;

  if (
    novoTitulo === textoOriginal.titulo &&
    novoConteudo === textoOriginal.conteudo
  ) {
    resultadoAnalise.textContent =
      "Você não alterou o texto. Use Cancelar edição para voltar.";
    return;
  }

  analisando = true;
  atualizarControlesAnalise();

  resultadoAnalise.textContent = "Salvando alterações...";

  try {
    const { data, error } = await supabase.rpc(
      "editar_mensagem_coordenacao",
      {
        p_mensagem_id: textoOriginal.id,
        p_titulo: novoTitulo,
        p_conteudo: novoConteudo,
        p_titulo_anterior: textoOriginal.titulo,
        p_conteudo_anterior: textoOriginal.conteudo
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error("O banco não confirmou a edição.");
    }

    // Atualiza a versão exibida após a confirmação do banco.
    textoOriginal = {
      id: data,
      titulo: novoTitulo,
      conteudo: novoConteudo
    };

    document.querySelector("#analise-assunto").textContent =
      novoTitulo;

    document.querySelector("#analise-conteudo").textContent =
      novoConteudo;

    editando = false;

    grupoEdicao.hidden = true;
    visualizacao.hidden = false;

    resultadoAnalise.textContent =
      "Alterações salvas! A mensagem continua aguardando aprovação.";

    // Atualiza também a tabela atrás da janela.
    await carregarPendentes();

  } catch (erro) {
    console.error("Erro ao editar mensagem:", erro);

    if (erro.code === "42501") {
      resultadoAnalise.textContent =
        "Edição não autorizada. Confira seu acesso de coordenação.";

    } else if (erro.code === "22023") {
      resultadoAnalise.textContent = erro.message;

    } else {
      resultadoAnalise.textContent =
        "Não foi possível confirmar o salvamento. Copie seu texto " +
        "para não perdê-lo e atualize a página para conferir " +
        "se a alteração foi registrada.";
    }

  } finally {
    analisando = false;
    atualizarControlesAnalise();
  }
});