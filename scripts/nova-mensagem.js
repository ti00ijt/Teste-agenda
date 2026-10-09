import { supabase } from "./supabase.js";

const nomeProfessor = document.querySelector("#envio-professor");
const nomeMateria = document.querySelector("#envio-materia");
const nomeTurma = document.querySelector("#envio-turma");
const mensagemCarregamento = document.querySelector(
  "#mensagem-carregamento-envio"
);

const grupoDestinatarios = document.querySelector("#grupo-destinatarios");
const grupoAlunos = document.querySelector("#grupo-alunos");
const listaAlunos = document.querySelector("#lista-alunos-envio");
const contadorAlunos = document.querySelector("#contador-alunos-envio");
const cancelarEnvio = document.querySelector("#cancelar-envio");

const tipoMensagem = document.querySelector("#tipo-mensagem");
const prazoMensagem = document.querySelector("#prazo-mensagem");

const parametros = new URLSearchParams(window.location.search);
const vinculoTurmaId = parametros.get("vinculo_turma");

let dadosProntos = false;

function atualizarDestinatarios() {
  const destino = grupoDestinatarios.querySelector(
    'input[name="destino"]:checked'
  )?.value;

  const individual = dadosProntos && destino === "individual";

  grupoAlunos.hidden = !individual;
  grupoAlunos.disabled = !individual;

  // Ao voltar para envio geral, limpa a seleção individual.
  if (!individual) {
    listaAlunos
      .querySelectorAll('input[type="checkbox"]')
      .forEach((campo) => {
        campo.checked = false;
      });
  }

  atualizarContador();
}

function atualizarContador() {
  const quantidade = listaAlunos.querySelectorAll(
    'input[type="checkbox"]:checked'
  ).length;

  contadorAlunos.textContent =
    quantidade === 0
      ? "Nenhum aluno selecionado."
      : `${quantidade} aluno(s) selecionado(s).`;
}

function atualizarPrazo() {
  const tarefa = tipoMensagem.value === "tarefa";

  prazoMensagem.disabled = !tarefa;

  if (!tarefa) prazoMensagem.value = "";
}

function mostrarErro(texto) {
  dadosProntos = false;
  atualizarBotaoEnviar();
  grupoDestinatarios.disabled = true;
  listaAlunos.replaceChildren();
  atualizarDestinatarios();

  nomeProfessor.textContent = "—";
  nomeMateria.textContent = "—";
  nomeTurma.textContent = "—";
  mensagemCarregamento.textContent = texto;
}

async function carregarDadosEnvio() {
  const formatoUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!vinculoTurmaId || !formatoUuid.test(vinculoTurmaId)) {
    mostrarErro(
      "Volte ao painel, escolha uma matéria e uma turma e clique em Escrever."
    );
    return;
  }

  try {
    const { data: dadosAuth, error: erroAuth } =
      await supabase.auth.getUser();

    if (erroAuth) throw erroAuth;

    if (!dadosAuth.user) {
      mostrarErro("Entre na sua conta para continuar.");
      return;
    }

    const { data: professor, error: erroProfessor } = await supabase
      .from("professores")
      .select("id, nome")
      .eq("usuario_id", dadosAuth.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (erroProfessor) throw erroProfessor;

    if (!professor) {
      mostrarErro("Cadastro indisponível. Procure a coordenação.");
      return;
    }

    const { data: vinculo, error: erroVinculo } = await supabase
      .from("professor_materia_turmas")
      .select(`
        id,
        turma:turmas (
          nome,
          ensino,
          periodo,
          ano_letivo,
          ativo
        ),
        professor_materia:professor_materias (
          professor_id,
          materia:materias (
            nome,
            ativo
          )
        )
      `)
      .eq("id", vinculoTurmaId)
      .eq("ativo", true)
      .maybeSingle();

    if (erroVinculo) throw erroVinculo;

    const professorMateria = vinculo?.professor_materia;
    const materia = professorMateria?.materia;
    const turma = vinculo?.turma;

    if (
      !vinculo ||
      professorMateria?.professor_id !== professor.id ||
      !materia?.ativo ||
      !turma?.ativo
    ) {
      mostrarErro("Essa turma não está disponível para sua conta.");
      return;
    }

    // A função do banco também verifica a autorização.
    const { data: alunos, error: erroAlunos } = await supabase.rpc(
      "listar_alunos_turma_professor",
      { p_vinculo_turma_id: vinculoTurmaId }
    );

    if (erroAlunos) throw erroAlunos;

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

    nomeProfessor.textContent = professor.nome;
    nomeMateria.textContent = materia.nome;

    nomeTurma.textContent =
      `${turma.nome} • ${ensinos[turma.ensino] ?? turma.ensino} • ` +
      `${periodos[turma.periodo] ?? turma.periodo} • ${turma.ano_letivo}`;

    const retorno = new URLSearchParams({
      vinculo_turma: vinculoTurmaId
    });

    cancelarEnvio.href = `turma-professor.html?${retorno.toString()}`;

    listaAlunos.replaceChildren();

    if (alunos.length === 0) {
      mensagemCarregamento.textContent =
        "Essa turma não possui alunos com matrícula atual.";
      return;
    }

    for (const aluno of alunos) {
      const opcao = document.createElement("label");
      opcao.className = "envio-aluno-opcao";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "alunos";
      checkbox.value = aluno.aluno_id;

      const texto = document.createElement("span");
      texto.textContent = `${aluno.nome} — RA: ${aluno.ra}`;

      opcao.append(checkbox, texto);
      listaAlunos.append(opcao);
    }

    dadosProntos = true;
    grupoDestinatarios.disabled = false;
    atualizarBotaoEnviar();
    mensagemCarregamento.textContent =
      `${alunos.length} aluno(s) disponível(is) nesta turma.`;

    atualizarDestinatarios();

  } catch (erro) {
    console.error("Erro ao preparar mensagem:", erro);

    mostrarErro(
      erro.code === "42501"
        ? "Acesso não autorizado à turma. Volte ao painel."
        : "Não foi possível carregar os dados. Atualize a página."
    );
  }
}

grupoDestinatarios.addEventListener("change", atualizarDestinatarios);
const botaoEnviar = document.querySelector("#enviar-mensagem");
const resultadoEnvio = document.querySelector("#resultado-envio");
const tituloMensagem = document.querySelector("#titulo-mensagem");
const textoMensagem = document.querySelector("#texto-mensagem");

tipoMensagem.required = true;
tituloMensagem.required = true;
tituloMensagem.maxLength = 150;
textoMensagem.required = true;
textoMensagem.maxLength = 10000;

let enviandoMensagem = false;
let envioConcluido = false;
let tentativaEnvio = null;
let estadosCampos = [];

function atualizarBotaoEnviar() {
  botaoEnviar.disabled =
    !dadosProntos || enviandoMensagem || envioConcluido;
}

function bloquearCamposEnvio() {
  const campos = [
    grupoDestinatarios,
    grupoAlunos,
    tipoMensagem,
    prazoMensagem,
    tituloMensagem,
    textoMensagem
  ];

  estadosCampos = campos.map((campo) => ({
    campo,
    desabilitado: campo.disabled
  }));

  campos.forEach((campo) => {
    campo.disabled = true;
  });
}

function restaurarCamposEnvio() {
  for (const estado of estadosCampos) {
    estado.campo.disabled = estado.desabilitado;
  }

  estadosCampos = [];
}

botaoEnviar.addEventListener("click", async () => {
  if (!dadosProntos || enviandoMensagem || envioConcluido) return;

  resultadoEnvio.textContent = "";

  // Só monta uma nova tentativa quando não existe envio pendente.
  if (!tentativaEnvio) {
    tituloMensagem.value = tituloMensagem.value.trim();
    textoMensagem.value = textoMensagem.value.trim();

    for (const campo of [
      tipoMensagem,
      tituloMensagem,
      textoMensagem,
      prazoMensagem
    ]) {
      if (!campo.reportValidity()) return;
    }

    const destino = grupoDestinatarios.querySelector(
      'input[name="destino"]:checked'
    )?.value;

    if (!["geral", "individual"].includes(destino)) {
      resultadoEnvio.textContent = "Escolha os destinatários.";
      return;
    }

    const alunos = destino === "individual"
      ? Array.from(
          listaAlunos.querySelectorAll(
            'input[type="checkbox"]:checked'
          ),
          (campo) => campo.value
        )
      : [];

    if (destino === "individual" && alunos.length === 0) {
      resultadoEnvio.textContent = "Selecione pelo menos um aluno.";
      return;
    }

    if (typeof globalThis.crypto?.randomUUID !== "function") {
      resultadoEnvio.textContent =
        "Não foi possível preparar o envio. Abra o site por HTTPS " +
        "ou pelo Live Server local.";
      return;
    }

    // Guarda os dados originais para uma eventual nova tentativa.
    tentativaEnvio = {
      p_chave_envio: crypto.randomUUID(),
      p_vinculo_turma_id: vinculoTurmaId,
      p_tipo: tipoMensagem.value,
      p_destino: destino,
      p_titulo: tituloMensagem.value,
      p_conteudo: textoMensagem.value,
      p_prazo:
        tipoMensagem.value === "tarefa" && prazoMensagem.value
          ? prazoMensagem.value
          : null,
      p_alunos: alunos
    };

    bloquearCamposEnvio();
  }

  enviandoMensagem = true;
  botaoEnviar.textContent = "Enviando...";
  atualizarBotaoEnviar();

  try {
    const { data: mensagemId, error } = await supabase.rpc(
      "enviar_mensagem_professor",
      tentativaEnvio
    );

    if (error) throw error;
    if (!mensagemId) throw new Error("Envio não confirmado.");

    envioConcluido = true;
    tentativaEnvio = null;

    resultadoEnvio.textContent =
      "Mensagem enviada para a coordenação! Status: Aguardando aprovação.";

    botaoEnviar.textContent = "Enviado para aprovação";
    cancelarEnvio.textContent = "Voltar para a turma";

  } catch (erro) {
    console.error("Erro ao enviar mensagem:", {
      codigo: erro.code,
      mensagem: erro.message
    });

    if (erro.code === "22023" || erro.code === "42501") {
      // A função rejeitou a operação: permite corrigir os dados.
      tentativaEnvio = null;
      restaurarCamposEnvio();
      botaoEnviar.textContent = "Enviar para aprovação";

      resultadoEnvio.textContent =
        erro.code === "42501"
          ? "Envio não autorizado. Volte ao painel e confira seu acesso."
          : erro.message;
    } else {
      // Pode ter sido salvo, mesmo sem recebermos a confirmação.
      // Mantém os dados e a chave para repetir sem duplicar.
      botaoEnviar.textContent = "Tentar confirmar envio";

      resultadoEnvio.textContent =
        "Não foi possível confirmar o envio. Mantenha esta página aberta " +
        "e clique em Tentar confirmar envio. Os dados foram preservados.";
    }
  } finally {
    enviandoMensagem = false;
    atualizarBotaoEnviar();
  }
});
listaAlunos.addEventListener("change", atualizarContador);
tipoMensagem.addEventListener("change", atualizarPrazo);

atualizarDestinatarios();
atualizarPrazo();
carregarDadosEnvio();