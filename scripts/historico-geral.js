import { supabase } from "./supabase.js";

const filtroTurma = document.querySelector("#filtro-turma");
const mensagemFiltro = document.querySelector("#mensagem-filtro-turmas");
const lista = document.querySelector("#lista-historico");
const mensagem = document.querySelector("#mensagem-historico");
const quantidade = document.querySelector("#quantidade-historico");

let consultaAtual = 0;

const ensinos = {
  "fundamental-1": "Fundamental I",
  "fundamental-2": "Fundamental II",
  medio: "Ensino Médio"
};

const periodos = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  integral: "Integral"
};

const tipos = {
  aviso: "Aviso",
  tarefa: "Tarefa",
  bilhete: "Bilhete"
};

const statusMensagens = {
  aguardando: {
    texto: "Aguardando aprovação",
    classe: "histgeral-status--pendente"
  },
  aprovado: {
    texto: "Aprovado",
    classe: "histgeral-status--aprovado"
  },
  reprovado: {
    texto: "Reprovado",
    classe: "histgeral-status--reprovado"
  }
};

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo"
});

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function identificarTurma(turma) {
  if (!turma) return "Turma indisponível";

  return [
    turma.nome,
    ensinos[turma.ensino] ?? turma.ensino,
    periodos[turma.periodo] ?? turma.periodo,
    turma.ano_letivo
  ].join(" • ");
}

function adicionarDado(listaDados, titulo, valor) {
  const grupo = document.createElement("div");

  grupo.append(
    criarElemento("dt", "", titulo),
    criarElemento("dd", "", valor)
  );

  listaDados.append(grupo);
}

async function carregarTurmas() {
  mensagemFiltro.textContent = "Carregando turmas...";

  try {
    // Inclui turmas inativas para consultar históricos antigos.
    const { data: turmas, error } = await supabase
      .from("turmas")
      .select("id, nome, ensino, periodo, ano_letivo, ativo")
      .order("ano_letivo", { ascending: false })
      .order("nome", { ascending: true });

    if (error) throw error;

    filtroTurma.replaceChildren(new Option("Todas as turmas", "todas"));

    for (const turma of turmas) {
      const nome =
        identificarTurma(turma) +
        (turma.ativo ? "" : " — Inativa");

      filtroTurma.add(new Option(nome, turma.id));
    }

    filtroTurma.disabled = false;
    mensagemFiltro.textContent = "";

  } catch (erro) {
    console.error("Erro ao carregar filtro de turmas:", erro);

    mensagemFiltro.textContent =
      "Não foi possível carregar o filtro. O histórico geral continua disponível.";
  }
}

function criarMensagem(registro) {
  const item = document.createElement("li");
  const artigo = criarElemento("article", "histgeral-mensagem");
  const topo = criarElemento("div", "histgeral-mensagem-topo");

  const data = document.createElement("time");
  data.dateTime = registro.criado_em;
  data.textContent = formatoData.format(new Date(registro.criado_em));

  topo.append(
    criarElemento(
      "span",
      "histgeral-tipo",
      tipos[registro.tipo] ?? registro.tipo
    ),
    data
  );

  const vinculo = registro.vinculo;
  const professorMateria = vinculo?.professor_materia;

  const nomeProfessor =
    professorMateria?.professor?.nome ?? "Professor indisponível";

  const nomeMateria =
    professorMateria?.materia?.nome ?? "Matéria indisponível";

  const dados = criarElemento("dl", "histgeral-dados");

  adicionarDado(
    dados,
    "Enviado por",
    `${nomeProfessor} • ${nomeMateria}`
  );

  adicionarDado(
    dados,
    "Turma",
    identificarTurma(vinculo?.turma)
  );

  adicionarDado(
    dados,
    "Destinatários",
    registro.destino === "geral"
      ? "Geral — alunos da turma no momento do envio"
      : "Individual — alunos selecionados"
  );

  if (registro.prazo) {
    const [ano, mes, dia] = registro.prazo.split("-");

    adicionarDado(dados, "Prazo da tarefa", `${dia}/${mes}/${ano}`);
  }

  const texto = criarElemento(
    "p",
    "histgeral-texto",
    registro.conteudo
  );

  texto.style.whiteSpace = "pre-wrap";
  texto.style.overflowWrap = "anywhere";

  const status = statusMensagens[registro.status] ?? {
    texto: "Status indisponível",
    classe: ""
  };

  const linhaStatus = criarElemento("div", "histgeral-status-linha");

  linhaStatus.append(
    criarElemento("span", "", "Status de aprovação:"),
    criarElemento(
      "span",
      `histgeral-status ${status.classe}`,
      status.texto
    )
  );

  artigo.append(
    topo,
    criarElemento("h3", "", registro.titulo),
    dados,
    texto,
    linhaStatus
  );

  if (registro.tipo === "bilhete" && registro.status === "aprovado") {
    artigo.append(criarConsultaAssinaturas(registro.id));
  }

  if (registro.analisado_em) {
    artigo.append(
      criarElemento(
        "p",
        "histgeral-observacao",
        `Analisada em ${formatoData.format(
          new Date(registro.analisado_em)
        )}.`
      )
    );
  }

  item.append(artigo);
  return item;
}

function criarConsultaAssinaturas(mensagemId) {
  const painel = criarElemento("details", "histgeral-assinaturas");
  painel.append(criarElemento("summary", "", "Consultar assinaturas"));
  const resultado = criarElemento("p", "", "Abra para consultar os destinatários deste bilhete.");
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
      const { data, error } = await supabase.rpc("consultar_assinaturas_coordenacao", {
        p_mensagem_id: mensagemId,
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Resposta inválida.");
      const assinados = data.filter((aluno) => aluno.assinado_em).length;
      resultado.textContent = data.length
        ? `${data.length} destinatário(s): ${assinados} assinado(s) e ${data.length - assinados} pendente(s).`
        : "Nenhum destinatário registrado para este bilhete.";
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
        ? "Acesso não autorizado. Confira seu perfil de coordenação."
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

async function carregarHistorico() {
  const consulta = ++consultaAtual;

  lista.replaceChildren();
  quantidade.textContent = "—";
  mensagem.textContent = "Carregando histórico...";

  try {
    let pedido = supabase
      .from("mensagens")
      .select(`
        id,
        criado_em,
        tipo,
        destino,
        titulo,
        conteudo,
        prazo,
        status,
        analisado_em,
        vinculo:professor_materia_turmas!inner (
          turma_id,
          turma:turmas (
            nome,
            ensino,
            periodo,
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
      `);

    if (filtroTurma.value !== "todas") {
      pedido = pedido.eq("vinculo.turma_id", filtroTurma.value);
    }

    const { data: registros, error } = await pedido
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);

    // Ignora respostas antigas se a turma mudou durante a consulta.
    if (consulta !== consultaAtual) return;

    if (error) throw error;

    quantidade.textContent =
      `${registros.length} mensagem(ns) exibida(s)`;

    if (registros.length === 0) {
      mensagem.textContent =
        "Nenhuma mensagem encontrada para este filtro.";
      return;
    }

    const fragmento = document.createDocumentFragment();

    for (const registro of registros) {
      fragmento.append(criarMensagem(registro));
    }

    lista.append(fragmento);

    mensagem.textContent =
      "Exibindo até 100 mensagens, da mais recente para a mais antiga.";

  } catch (erro) {
    if (consulta !== consultaAtual) return;

    console.error("Erro ao carregar histórico:", erro);

    mensagem.textContent =
      "Não foi possível carregar o histórico. Confira o Console.";
  }
}

filtroTurma.addEventListener("change", carregarHistorico);

async function iniciarHistorico() {
  await Promise.all([
    carregarTurmas(),
    carregarHistorico()
  ]);
}

iniciarHistorico();
