import { supabase } from "./supabase.js";

const campoTurma = document.querySelector("#turma-aluno");
const mensagemTurmas = document.querySelector("#mensagem-turmas-aluno");

const nomesEnsino = {
  "fundamental-1": "Fundamental I",
  "fundamental-2": "Fundamental II",
  "medio": "Ensino Médio"
};

const nomesPeriodo = {
  "manha": "Manhã",
  "tarde": "Tarde",
  "noite": "Noite",
  "integral": "Integral"
};

async function carregarOpcoesTurmas() {
  campoTurma.disabled = true;
  mensagemTurmas.textContent = "";

  try {
    const { data: turmas, error } = await supabase
      .from("turmas")
      .select("id, nome, ensino, periodo, ano_letivo")
      .eq("ativo", true)
      .order("ano_letivo", { ascending: false })
      .order("nome", { ascending: true });

    if (error) throw error;

    campoTurma.replaceChildren();

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = turmas.length
      ? "Selecione a turma"
      : "Nenhuma turma ativa disponível";

    campoTurma.append(opcaoInicial);

    for (const turma of turmas) {
      const opcao = document.createElement("option");

      // O valor enviado será o identificador real da turma.
      opcao.value = turma.id;

      // O usuário verá uma descrição compreensível.
      opcao.textContent =
        `${turma.nome} — ` +
        `${nomesEnsino[turma.ensino] ?? turma.ensino} — ` +
        `${nomesPeriodo[turma.periodo] ?? turma.periodo} — ` +
        `${turma.ano_letivo}`;

      campoTurma.append(opcao);
    }

    campoTurma.disabled = turmas.length === 0;

    if (turmas.length === 0) {
      mensagemTurmas.textContent =
        "Cadastre ou reative uma turma antes de cadastrar alunos.";
    }

  } catch (erro) {
    campoTurma.replaceChildren();

    const opcaoErro = document.createElement("option");
    opcaoErro.value = "";
    opcaoErro.textContent = "Turmas indisponíveis";
    campoTurma.append(opcaoErro);

    mensagemTurmas.textContent =
      "Não foi possível carregar as turmas. Recarregue a página para tentar novamente.";

    console.error("Erro ao carregar turmas:", {
      codigo: erro.code,
      mensagem: erro.message
    });
  }
}

// Executa ao abrir a página.
carregarOpcoesTurmas();












const formularioAluno = document.querySelector("#form-cadastro-aluno");
const nomeAluno = document.querySelector("#nome-aluno");
const raAluno = document.querySelector("#ra-aluno");
const botaoCadastrar = document.querySelector("#cadastrar-aluno");
const mensagemAluno = document.querySelector("#mensagem-aluno");

let cadastrandoAluno = false;

nomeAluno.required = true;
raAluno.required = true;

formularioAluno.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (cadastrandoAluno) return;

  mensagemAluno.textContent = "";

  // campoTurma já foi definido no código de carregamento das turmas.
  if (campoTurma.disabled || !campoTurma.value) {
    mensagemAluno.textContent = "Selecione uma turma ativa.";
    return;
  }

  nomeAluno.value = nomeAluno.value.trim().replace(/\s+/g, " ");
  raAluno.value = raAluno.value.trim();

  if (!formularioAluno.reportValidity()) return;

  // Guarda os valores desta tentativa antes de iniciar o envio.
  const dadosAluno = {
    p_nome: nomeAluno.value,
    p_ra: raAluno.value,
    p_turma_id: campoTurma.value
  };

  cadastrandoAluno = true;
  botaoCadastrar.disabled = true;

  const textoOriginal = botaoCadastrar.textContent;
  botaoCadastrar.textContent = "Cadastrando...";

  try {
    const { data: alunoId, error } = await supabase.rpc(
      "cadastrar_aluno_com_matricula",
      dadosAluno
    );

    if (error) {
      console.error("Erro ao cadastrar aluno:", {
        codigo: error.code,
        mensagem: error.message
      });

      if (error.code === "23505") {
        mensagemAluno.textContent =
          "Já existe um cadastro com esses dados. Confira o RA antes de repetir.";
      } else if (error.code === "42501") {
        mensagemAluno.textContent =
          "Edição não autorizada. Confira seu acesso de coordenação.";
      } else if (error.code === "22023") {
        mensagemAluno.textContent = error.message;
      } else {
        mensagemAluno.textContent =
          "Não foi possível confirmar o cadastro. Confira o Console e o banco antes de repetir.";
      }

      return;
    }

    if (!alunoId) {
      mensagemAluno.textContent =
        "O banco não retornou a confirmação esperada. Confira o cadastro antes de repetir.";
      return;
    }

    mensagemAluno.textContent =
      `Aluno ${dadosAluno.p_nome} cadastrado e matriculado com sucesso!`;

    // Limpa os dados, mantendo a turma selecionada.
    nomeAluno.value = "";
    raAluno.value = "";
    nomeAluno.focus();
    await carregarAlunosDaTurma();
    
  } catch {
    mensagemAluno.textContent =
      "Não foi possível confirmar o cadastro. Confira sua conexão e o banco antes de repetir.";

  } finally {
    cadastrandoAluno = false;
    botaoCadastrar.disabled = false;
    botaoCadastrar.textContent = textoOriginal;
  }
});














const listaAlunos = document.querySelector("#lista-alunos");
const contadorAlunos = document.querySelector("#contador-alunos");
const turmaDaLista = document.querySelector("#turma-da-lista");
const mensagemListaAlunos = document.querySelector("#mensagem-lista-alunos");

// Evita que uma consulta antiga sobrescreva a turma recém-selecionada.
let consultaAlunosAtual = 0;

async function carregarAlunosDaTurma() {
  const numeroConsulta = ++consultaAlunosAtual;
  const turmaId = campoTurma.value;

  listaAlunos.replaceChildren();
  contadorAlunos.textContent = "—";

  if (!turmaId) {
    turmaDaLista.textContent = "Nenhuma selecionada";
    mensagemListaAlunos.textContent =
      "Selecione uma turma para consultar os alunos.";
    return;
  }

  turmaDaLista.textContent =
    campoTurma.selectedOptions[0].textContent;

  mensagemListaAlunos.textContent = "Carregando alunos...";

  try {
    // Busca as matrículas abertas e os dados dos alunos vinculados.
    const { data: matriculas, error } = await supabase
      .from("matriculas")
      .select("id, aluno:alunos(id, nome, ra)")
      .eq("turma_id", turmaId)
      .is("data_fim", null);

    // Ignora a resposta se outra consulta já começou.
    if (numeroConsulta !== consultaAlunosAtual) return;

    if (error) throw error;

    if (matriculas.some((matricula) => !matricula.aluno)) {
      throw new Error(
        "Uma matrícula foi encontrada, mas os dados do aluno não estão acessíveis."
      );
    }

     const alunos = matriculas
        .map((matricula) => ({
            ...matricula.aluno,
            matriculaId: matricula.id
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        
    contadorAlunos.textContent =
      `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}`;

    if (alunos.length === 0) {
      mensagemListaAlunos.textContent =
        "Nenhum aluno com matrícula aberta nesta turma.";
      return;
    }

    const itens = document.createDocumentFragment();

    for (const aluno of alunos) {
      const item = document.createElement("li");
      item.className = "cadaluno-item";

      const dados = document.createElement("div");
      dados.className = "cadaluno-dados";

      const titulo = document.createElement("h3");
      titulo.textContent = aluno.nome;

      const registro = document.createElement("p");
      registro.textContent = `RA: ${aluno.ra}`;

      const botaoEncerrar = document.createElement("button");
        botaoEncerrar.type = "button";
        botaoEncerrar.className = "cadaluno-excluir";
        botaoEncerrar.textContent = "Encerrar matrícula";

        botaoEncerrar.setAttribute(
        "aria-label",
        `Encerrar matrícula de ${aluno.nome}`
        );

        botaoEncerrar.addEventListener("click", () => {
        encerrarMatricula(aluno, botaoEncerrar);
        });

       const botaoTransferir = document.createElement("button");
botaoTransferir.type = "button";
botaoTransferir.className = "cadaluno-excluir";
botaoTransferir.textContent = "Transferir";

botaoTransferir.setAttribute(
  "aria-label",
  `Transferir ${aluno.nome}`
);

botaoTransferir.addEventListener("click", () => {
  abrirTransferencia(aluno, turmaId);
});

    const acoes = document.createElement("div");
    acoes.className = "cadaluno-acoes-item";
    acoes.append(botaoTransferir, botaoEncerrar);

    dados.append(titulo, registro);
    item.append(dados, acoes);
    itens.append(item);
    }

    listaAlunos.append(itens);
    mensagemListaAlunos.textContent = "";

  } catch (erro) {
    if (numeroConsulta !== consultaAlunosAtual) return;

    contadorAlunos.textContent = "Indisponível";
    mensagemListaAlunos.textContent =
      "Não foi possível carregar os alunos. Selecione a turma novamente para tentar.";

    console.error("Erro ao listar alunos:", {
      codigo: erro.code,
      mensagem: erro.message
    });
  }
}

// Atualiza a lista quando você troca a turma.
campoTurma.addEventListener("change", carregarAlunosDaTurma);

// Define o estado inicial da lista.
carregarAlunosDaTurma();






async function encerrarMatricula(aluno, botaoEncerrar) {
  const confirmou = window.confirm(
    `Encerrar a matrícula de ${aluno.nome}, RA ${aluno.ra}?\n\n` +
    "A saída será registrada com a data atual. " +
    "O cadastro e o histórico serão preservados."
  );

  if (!confirmou || botaoEncerrar.disabled) return;

  botaoEncerrar.disabled = true;
  botaoEncerrar.textContent = "Encerrando...";
  mensagemAluno.textContent = "";

  try {
    const { data: matriculaId, error } = await supabase.rpc(
      "encerrar_matricula",
      {
        p_matricula_id: aluno.matriculaId
      }
    );

    if (error) {
      console.error("Erro ao encerrar matrícula:", {
        codigo: error.code,
        mensagem: error.message
      });

      if (error.code === "42501") {
        mensagemAluno.textContent =
          "Edição não autorizada. Confira seu acesso de coordenação.";
      } else if (error.code === "22023") {
        mensagemAluno.textContent = error.message;
      } else {
        mensagemAluno.textContent =
          "Não foi possível confirmar o encerramento. Confira o Console e atualize a lista antes de repetir.";
      }

      return;
    }

    if (matriculaId !== aluno.matriculaId) {
      mensagemAluno.textContent =
        "A confirmação recebida foi inesperada. Confira a matrícula no banco antes de repetir.";
      return;
    }

    mensagemAluno.textContent =
      `Matrícula de ${aluno.nome} encerrada com sucesso.`;

    await carregarAlunosDaTurma();

  } catch {
    mensagemAluno.textContent =
      "Não foi possível confirmar o encerramento. Confira sua conexão e atualize a lista antes de repetir.";

  } finally {
    botaoEncerrar.disabled = false;
    botaoEncerrar.textContent = "Encerrar matrícula";
  }
}

const janelaTransferencia =
  document.querySelector("#janela-transferencia");

const alunoTransferencia =
  document.querySelector("#aluno-transferencia");

const campoDestino =
  document.querySelector("#turma-destino");

const mensagemTransferencia =
  document.querySelector("#mensagem-transferencia");

const cancelarTransferencia =
  document.querySelector("#cancelar-transferencia");

const confirmarTransferencia =
  document.querySelector("#confirmar-transferencia");

let transferenciaAtual = null;
let transferindo = false;
let consultaDestinos = 0;

async function abrirTransferencia(aluno, turmaOrigemId) {
  const consulta = ++consultaDestinos;

  transferenciaAtual = {
    matriculaId: aluno.matriculaId,
    nome: aluno.nome,
    turmaOrigemId
  };

  alunoTransferencia.textContent =
    `${aluno.nome} — RA: ${aluno.ra}`;

  campoDestino.replaceChildren();
  campoDestino.disabled = true;
  confirmarTransferencia.disabled = true;

  mensagemTransferencia.textContent = "Carregando turmas...";
  janelaTransferencia.showModal();

  try {
    // Consulta novamente para trazer as turmas ativas atuais.
    const { data: turmas, error } = await supabase
      .from("turmas")
      .select("id, nome, ensino, periodo, ano_letivo")
      .eq("ativo", true)
      .neq("id", turmaOrigemId)
      .order("ano_letivo", { ascending: false })
      .order("nome", { ascending: true });

    if (consulta !== consultaDestinos) return;

    if (error) throw error;

    campoDestino.append(new Option("Selecione a turma", ""));

    for (const turma of turmas) {
      const descricao =
        `${turma.nome} — ` +
        `${nomesEnsino[turma.ensino] ?? turma.ensino} — ` +
        `${nomesPeriodo[turma.periodo] ?? turma.periodo} — ` +
        `${turma.ano_letivo}`;

      campoDestino.append(new Option(descricao, turma.id));
    }

    campoDestino.disabled = turmas.length === 0;
    confirmarTransferencia.disabled = turmas.length === 0;

    mensagemTransferencia.textContent = turmas.length
      ? ""
      : "Não há outra turma ativa disponível.";

    if (turmas.length) campoDestino.focus();

  } catch (erro) {
    if (consulta !== consultaDestinos) return;

    mensagemTransferencia.textContent =
      "Não foi possível carregar as turmas. Feche e tente novamente.";

    console.error("Erro ao carregar destinos:", {
      codigo: erro.code,
      mensagem: erro.message
    });
  }
}

cancelarTransferencia.addEventListener("click", () => {
  if (!transferindo) janelaTransferencia.close();
});

// Impede fechar com Escape enquanto o banco processa a operação.
janelaTransferencia.addEventListener("cancel", (evento) => {
  if (transferindo) evento.preventDefault();
});

janelaTransferencia.addEventListener("close", () => {
  consultaDestinos++;
  transferenciaAtual = null;
});

confirmarTransferencia.addEventListener("click", async () => {
  if (transferindo || !transferenciaAtual) return;
  if (campoDestino.disabled || !campoDestino.reportValidity()) return;

  const transferencia = { ...transferenciaAtual };
  const destinoId = campoDestino.value;

  transferindo = true;
  confirmarTransferencia.disabled = true;
  cancelarTransferencia.disabled = true;
  campoDestino.disabled = true;

  confirmarTransferencia.textContent = "Transferindo...";
  mensagemTransferencia.textContent = "";

  try {
    const { data: novaMatriculaId, error } = await supabase.rpc(
      "transferir_aluno",
      {
        p_matricula_id: transferencia.matriculaId,
        p_turma_destino_id: destinoId
      }
    );

    if (error) throw error;

    if (!novaMatriculaId) {
      throw new Error("O banco não retornou a nova matrícula.");
    }

    mensagemAluno.textContent =
      `${transferencia.nome} transferido(a) com sucesso.`;

    janelaTransferencia.close();
    await carregarAlunosDaTurma();

  } catch (erro) {
    console.error("Erro ao transferir aluno:", {
      codigo: erro.code,
      mensagem: erro.message
    });

    if (erro.code === "42501") {
      mensagemTransferencia.textContent =
        "Edição não autorizada. Confira seu acesso de coordenação.";
    } else if (erro.code === "22023") {
      mensagemTransferencia.textContent = erro.message;
    } else {
      mensagemTransferencia.textContent =
        "Não foi possível confirmar a transferência. Confira as matrículas no banco antes de repetir.";
    }

  } finally {
    transferindo = false;
    confirmarTransferencia.disabled = false;
    cancelarTransferencia.disabled = false;
    campoDestino.disabled = false;
    confirmarTransferencia.textContent = "Confirmar transferência";
  }
});