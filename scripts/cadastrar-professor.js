import { supabase } from "./supabase.js";

const formulario = document.querySelector("#form-cadastro-professor");
const nome = document.querySelector("#nome-professor");
const codigo = document.querySelector("#codigo-professor");
const botao = document.querySelector("#cadastrar-professor");
const mensagem = document.querySelector("#mensagem-professor");

let salvando = false;

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (salvando) return;

  mensagem.textContent = "";

  nome.value = nome.value.trim().replace(/\s+/g, " ");
  codigo.value = codigo.value.trim();

  if (!formulario.reportValidity()) return;

  if (materiasSelecionadas.size === 0) {
  mensagem.textContent = "Adicione pelo menos uma matéria.";
  return;
}

  const dadosProfessor = {
    nome: nome.value,
    codigo: codigo.value,
    materias: [...materiasSelecionadas.keys()]
  };

  salvando = true;
  botao.disabled = true;
  nome.readOnly = true;
  codigo.readOnly = true;
  botao.textContent = "Salvando...";

  try {
    const { error } = await supabase.rpc(
    "cadastrar_professor_com_materias",
    {
      p_nome: dadosProfessor.nome,
      p_codigo: dadosProfessor.codigo,
      p_materias: dadosProfessor.materias
  }
);

    if (error) throw error;

    mensagem.textContent =
      `Professor ${dadosProfessor.nome} cadastrado com sucesso!`;

    nome.value = "";
    codigo.value = "";
    await carregarProfessores();
    materiasSelecionadas.clear();
    campoMateria.value = "";
    renderizarMateriasSelecionadas();

  } catch (erro) {
    console.error("Erro ao cadastrar professor:", {
      codigo: erro.code,
      mensagem: erro.message
    });

    if (erro.code === "23505") {
      mensagem.textContent =
        "Já existe um professor com esse código.";
    } else if (erro.code === "42501") {
      mensagem.textContent =
        "Cadastro não autorizado. Entre como coordenação ativa.";
    } 
    if (erro.code === "23505") {
        mensagem.textContent =
          "Já existe um professor com esse código.";
      } else if (erro.code === "42501") {
        mensagem.textContent =
          "Cadastro não autorizado. Entre como coordenação ativa.";
      } else if (erro.code === "22023") {
        mensagem.textContent = erro.message;
      } else {
        mensagem.textContent =
          "Não foi possível confirmar o cadastro. Confira a tabela " +
          "professores no Supabase antes de tentar novamente.";
      }

    
  } finally {
    salvando = false;
    atualizarBotaoMateria();
    botao.disabled = false;
    nome.readOnly = false;
    codigo.readOnly = false;
    botao.textContent = "Finalizar cadastro";
  }
});

botao.disabled = false;
botao.textContent = "Finalizar cadastro";

const listaProfessores = document.querySelector("#lista-professores");
const mensagemLista = document.querySelector(
  "#mensagem-lista-professores"
);

let consultaAtual = 0;

async function carregarProfessores() {
  console.log("Iniciando consulta dos professos")
  const consulta = ++consultaAtual;

  listaProfessores.replaceChildren();
  mensagemLista.textContent = "Carregando professores...";

  try {
    const { data: professores, error } = await supabase
      .from("professores")
      .select(`
        id,
        nome,
        codigo,
        professor_materias (
          materia:materias (
            nome
          ),
          professor_materia_turmas (
            ativo,
            turma:turmas (
              nome,
              ensino,
              periodo,
              ano_letivo,
              ativo
            )
          )
        )
      `)
      .eq("ativo", true)
      .order("nome", { ascending: true });
      console.log("Resultado da consulta:", {
      quantidade: professores?.length,
      erro: error
});

    if (consulta !== consultaAtual) return;
    if (error) throw error;

    if (professores.length === 0) {
      mensagemLista.textContent = "Nenhum professor cadastrado.";
      return;
    }

    for (const professor of professores) {
      const item = document.createElement("li");
      item.className = "cadprof-registro";

      const nomeProfessor = document.createElement("h3");
      nomeProfessor.textContent = professor.nome;

      const codigoProfessor = document.createElement("p");
      codigoProfessor.textContent = `Código: ${professor.codigo}`;

      const materiasProfessor = document.createElement("div");
materiasProfessor.className = "cadprof-materias-resumo";

const vinculos = professor.professor_materias ?? [];

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

if (vinculos.length === 0) {
  const aviso = document.createElement("p");
  aviso.textContent = "Nenhuma matéria vinculada.";
  materiasProfessor.append(aviso);
}

const vinculosOrdenados = [...vinculos].sort((a, b) =>
  (a.materia?.nome ?? "").localeCompare(
    b.materia?.nome ?? "",
    "pt-BR"
  )
);

for (const vinculo of vinculosOrdenados) {
  const bloco = document.createElement("div");

  const tituloMateria = document.createElement("strong");
  tituloMateria.textContent =
    vinculo.materia?.nome ?? "Matéria indisponível";

  bloco.append(tituloMateria);

  const vinculosAtivos = (
    vinculo.professor_materia_turmas ?? []
  ).filter((vinculoTurma) => vinculoTurma.ativo);

  const turmas = vinculosAtivos
    .map((vinculoTurma) => vinculoTurma.turma)
    .filter((turma) => turma?.ativo)
    .sort((a, b) =>
      b.ano_letivo - a.ano_letivo ||
      a.nome.localeCompare(b.nome, "pt-BR")
    ); 

      if (turmas.length === 0) {
        const aviso = document.createElement("p");
        aviso.textContent = "Nenhuma turma ativa disponível.";
        bloco.append(aviso);
      } else {
        const listaTurmas = document.createElement("ul");

        for (const turma of turmas) {
          const linha = document.createElement("li");

          linha.textContent =
            `${turma.nome} • ` +
            `${ensinos[turma.ensino] ?? turma.ensino} • ` +
            `${periodos[turma.periodo] ?? turma.periodo} • ` +
            `${turma.ano_letivo}`;

          listaTurmas.append(linha);
        }

        bloco.append(listaTurmas);
      }

      materiasProfessor.append(bloco);
    }

    item.append(
      nomeProfessor,
      codigoProfessor,
      materiasProfessor
    );
      const adicionarMateria = document.createElement("button");
        adicionarMateria.type = "button";
        adicionarMateria.className = "cadprof-adicionar";
        adicionarMateria.textContent = "Adicionar matéria";

        adicionarMateria.addEventListener("click", () => {
          abrirVinculoMateria(professor);
        });

item.append(adicionarMateria);
  const vincularTurma = document.createElement("button");
  vincularTurma.type = "button";
  vincularTurma.className = "cadprof-adicionar";
  vincularTurma.textContent = "Vincular turma";

  vincularTurma.addEventListener("click", () => {
    abrirTurmasProfessor(professor);
  });

item.append(vincularTurma);
      listaProfessores.append(item);
    }

    mensagemLista.textContent =
      `${professores.length} professor(es) cadastrado(s).`;

  } catch (erro) {
    if (consulta !== consultaAtual) return;

    console.error("Erro ao listar professores:", erro);

    mensagemLista.textContent =
      "Não foi possível carregar a lista. Atualize a página.";
  }
}

carregarProfessores();

const campoMateria = document.querySelector("#materia-professor");
const mensagemMaterias = document.querySelector("#mensagem-materias");

async function carregarMaterias() {
  campoMateria.disabled = true;
  campoMateria.replaceChildren(
    new Option("Carregando matérias...", "")
  );

  mensagemMaterias.textContent = "";

  try {
    const { data: materias, error } = await supabase
      .from("materias")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) throw error;

    campoMateria.replaceChildren(
      new Option("Selecione uma matéria", "")
    );

    if (materias.length === 0) {
      mensagemMaterias.textContent =
        "Nenhuma matéria disponível para seleção.";
      return;
    }

    for (const materia of materias) {
      // O usuário vê o nome; o valor da opção é o ID do banco.
      campoMateria.add(new Option(materia.nome, materia.id));
    }

    campoMateria.disabled = false;

  } catch (erro) {
    console.error("Erro ao carregar matérias:", erro);

    campoMateria.replaceChildren(
      new Option("Matérias indisponíveis", "")
    );

    mensagemMaterias.textContent =
      "Não foi possível carregar as matérias. Atualize a página.";
  }
}

carregarMaterias();

const botaoAdicionarMateria = document.querySelector("#adicionar-materia");
const listaMateriasSelecionadas = document.querySelector(
  "#materias-selecionadas"
);
const avisoMateriasVazias = document.querySelector("#materias-vazias");

// Guarda o ID e o nome de cada matéria escolhida.
const materiasSelecionadas = new Map();

function atualizarBotaoMateria() {
  botaoAdicionarMateria.disabled =
    salvando ||
    campoMateria.disabled ||
    !campoMateria.value ||
    materiasSelecionadas.has(campoMateria.value);
}

function renderizarMateriasSelecionadas() {
  listaMateriasSelecionadas.replaceChildren();

  avisoMateriasVazias.hidden = materiasSelecionadas.size > 0;

  for (const [id, nomeMateria] of materiasSelecionadas) {
    const item = document.createElement("li");

    const texto = document.createElement("span");
    texto.textContent = nomeMateria;

    const remover = document.createElement("button");
    remover.type = "button";
    remover.textContent = "Remover";
    remover.setAttribute("aria-label", `Remover ${nomeMateria}`);

    remover.addEventListener("click", () => {
      if (salvando) return;

      materiasSelecionadas.delete(id);
      renderizarMateriasSelecionadas();
    });

    item.append(texto, remover);
    listaMateriasSelecionadas.append(item);
  }

  atualizarBotaoMateria();
}

campoMateria.addEventListener("change", atualizarBotaoMateria);

botaoAdicionarMateria.addEventListener("click", () => {
  if (salvando || campoMateria.disabled) return;

  const id = campoMateria.value;
  const opcao = campoMateria.selectedOptions[0];

  if (!id || !opcao || materiasSelecionadas.has(id)) return;

  materiasSelecionadas.set(id, opcao.textContent);

  campoMateria.value = "";
  renderizarMateriasSelecionadas();
});

renderizarMateriasSelecionadas();

const janelaVinculo = document.querySelector("#janela-materia-professor");
const professorDoVinculo = document.querySelector("#professor-do-vinculo");
const materiaDoVinculo = document.querySelector("#materia-do-vinculo");
const mensagemVinculo = document.querySelector("#mensagem-vinculo");
const cancelarVinculo = document.querySelector("#cancelar-vinculo");
const salvarVinculo = document.querySelector("#salvar-vinculo");

let professorParaVincular = null;
let salvandoVinculo = false;
let consultaVinculo = 0;

async function abrirVinculoMateria(professor) {
  if (janelaVinculo.open || salvandoVinculo) return;

  const consulta = ++consultaVinculo;

  professorParaVincular = professor.id;
  professorDoVinculo.textContent = professor.nome;
  mensagemVinculo.textContent = "Carregando matérias...";

  materiaDoVinculo.disabled = true;
  salvarVinculo.disabled = true;
  materiaDoVinculo.replaceChildren(
    new Option("Selecione uma matéria", "")
  );

  janelaVinculo.showModal();

  try {
    const { data: materias, error } = await supabase
      .from("materias")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (consulta !== consultaVinculo) return;
    if (error) throw error;

    if (materias.length === 0) {
      mensagemVinculo.textContent = "Nenhuma matéria disponível.";
      return;
    }

    for (const materia of materias) {
      materiaDoVinculo.add(new Option(materia.nome, materia.id));
    }

    materiaDoVinculo.disabled = false;
    mensagemVinculo.textContent =
      "Se a matéria já estiver vinculada, ela não será duplicada.";

  } catch (erro) {
    if (consulta !== consultaVinculo) return;

    console.error("Erro ao carregar matérias para vínculo:", erro);
    mensagemVinculo.textContent =
      "Não foi possível carregar as matérias. Feche e tente novamente.";
  }
}

materiaDoVinculo.addEventListener("change", () => {
  salvarVinculo.disabled = salvandoVinculo || !materiaDoVinculo.value;
});

cancelarVinculo.addEventListener("click", () => {
  if (!salvandoVinculo) janelaVinculo.close();
});

// Impede fechar com Escape enquanto a gravação está em andamento.
janelaVinculo.addEventListener("cancel", (evento) => {
  if (salvandoVinculo) evento.preventDefault();
});

janelaVinculo.addEventListener("close", () => {
  consultaVinculo++;
  professorParaVincular = null;
});

salvarVinculo.addEventListener("click", async () => {
  if (salvandoVinculo || !professorParaVincular) return;

  if (!materiaDoVinculo.value) {
    mensagemVinculo.textContent = "Selecione uma matéria.";
    return;
  }

  const professorId = professorParaVincular;
  const materiaId = materiaDoVinculo.value;

  salvandoVinculo = true;
  salvarVinculo.disabled = true;
  cancelarVinculo.disabled = true;
  materiaDoVinculo.disabled = true;
  salvarVinculo.textContent = "Salvando...";
  mensagemVinculo.textContent = "";

  try {
    const { data: vinculoId, error } = await supabase.rpc(
      "vincular_materia_professor",
      {
        p_professor_id: professorId,
        p_materia_id: materiaId
      }
    );

    if (error) throw error;
    if (!vinculoId) throw new Error("Vínculo não confirmado.");

    mensagemVinculo.textContent =
      "Matéria vinculada! Você pode adicionar outra ou fechar.";

    materiaDoVinculo.value = "";

    await carregarProfessores();

  } catch (erro) {
    console.error("Erro ao vincular matéria:", erro);

    if (erro.code === "42501") {
      mensagemVinculo.textContent =
        "Operação não autorizada. Entre como coordenação ativa.";
    } else if (erro.code === "22023") {
      mensagemVinculo.textContent = erro.message;
    } else {
      mensagemVinculo.textContent =
        "Não foi possível confirmar o vínculo. Feche a janela " +
        "e atualize a lista antes de tentar novamente.";
    }
  } finally {
    salvandoVinculo = false;
    salvarVinculo.textContent = "Adicionar";
    salvarVinculo.disabled = !materiaDoVinculo.value;
    cancelarVinculo.disabled = false;
    materiaDoVinculo.disabled = false;
  }
});

const janelaTurmaProfessor = document.querySelector(
  "#janela-turma-professor"
);
const nomeProfessorTurma = document.querySelector("#nome-professor-turma");
const campoVinculoMateria = document.querySelector(
  "#vinculo-materia-professor"
);
const campoTurmaProfessor = document.querySelector("#turma-professor");
const mensagemTurmaProfessor = document.querySelector(
  "#mensagem-turma-professor"
);
const fecharTurmaProfessor = document.querySelector(
  "#fechar-turma-professor"
);
const salvarTurmaProfessor = document.querySelector(
  "#salvar-turma-professor"
);

let salvandoTurmaProfessor = false;
let consultaTurmaProfessor = 0;

function atualizarBotaoTurmaProfessor() {
  salvarTurmaProfessor.disabled =
    salvandoTurmaProfessor ||
    campoVinculoMateria.disabled ||
    campoTurmaProfessor.disabled ||
    !campoVinculoMateria.value ||
    !campoTurmaProfessor.value;
}

async function abrirTurmasProfessor(professor) {
  if (janelaTurmaProfessor.open || salvandoTurmaProfessor) return;

  const consulta = ++consultaTurmaProfessor;

  nomeProfessorTurma.textContent = professor.nome;
  mensagemTurmaProfessor.textContent = "Carregando opções...";

  campoVinculoMateria.disabled = true;
  campoTurmaProfessor.disabled = true;

  campoVinculoMateria.replaceChildren(
    new Option("Selecione uma matéria", "")
  );
  campoTurmaProfessor.replaceChildren(
    new Option("Selecione uma turma", "")
  );

  atualizarBotaoTurmaProfessor();
  janelaTurmaProfessor.showModal();

  try {
    const [resultadoMaterias, resultadoTurmas] = await Promise.all([
      supabase
        .from("professor_materias")
        .select("id, materia:materias(nome, ativo)")
        .eq("professor_id", professor.id),

      supabase
        .from("turmas")
        .select("id, nome, ensino, periodo, ano_letivo")
        .eq("ativo", true)
        .order("ano_letivo", { ascending: false })
        .order("nome", { ascending: true })
    ]);

    if (consulta !== consultaTurmaProfessor) return;

    if (resultadoMaterias.error) throw resultadoMaterias.error;
    if (resultadoTurmas.error) throw resultadoTurmas.error;

    const vinculos = resultadoMaterias.data
      .filter((vinculo) => vinculo.materia?.ativo)
      .sort((a, b) =>
        a.materia.nome.localeCompare(b.materia.nome, "pt-BR")
      );

    const turmas = resultadoTurmas.data;

    if (vinculos.length === 0) {
      mensagemTurmaProfessor.textContent =
        "Adicione uma matéria ativa a esse professor primeiro.";
      return;
    }

    if (turmas.length === 0) {
      mensagemTurmaProfessor.textContent =
        "Cadastre uma turma ativa primeiro.";
      return;
    }

    for (const vinculo of vinculos) {
      // O valor é o ID do vínculo professor–matéria.
      campoVinculoMateria.add(
        new Option(vinculo.materia.nome, vinculo.id)
      );
    }

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

    for (const turma of turmas) {
      const rotulo =
        `${turma.nome} • ${ensinos[turma.ensino] ?? turma.ensino} • ` +
        `${periodos[turma.periodo] ?? turma.periodo} • ${turma.ano_letivo}`;

      campoTurmaProfessor.add(new Option(rotulo, turma.id));
    }

    campoVinculoMateria.disabled = false;
    campoTurmaProfessor.disabled = false;

    mensagemTurmaProfessor.textContent =
      "Escolha a matéria e a turma em que o professor leciona.";

    atualizarBotaoTurmaProfessor();

  } catch (erro) {
    if (consulta !== consultaTurmaProfessor) return;

    console.error("Erro ao carregar opções de turma:", erro);
    mensagemTurmaProfessor.textContent =
      "Não foi possível carregar as opções. Feche e tente novamente.";
  }
}

campoVinculoMateria.addEventListener(
  "change",
  atualizarBotaoTurmaProfessor
);

campoTurmaProfessor.addEventListener(
  "change",
  atualizarBotaoTurmaProfessor
);

fecharTurmaProfessor.addEventListener("click", () => {
  if (!salvandoTurmaProfessor) janelaTurmaProfessor.close();
});

janelaTurmaProfessor.addEventListener("cancel", (evento) => {
  if (salvandoTurmaProfessor) evento.preventDefault();
});

janelaTurmaProfessor.addEventListener("close", () => {
  consultaTurmaProfessor++;
});

salvarTurmaProfessor.addEventListener("click", async () => {
  if (
    salvandoTurmaProfessor ||
    campoVinculoMateria.disabled ||
    campoTurmaProfessor.disabled ||
    !campoVinculoMateria.value ||
    !campoTurmaProfessor.value
  ) {
    return;
  }

  const vinculoMateriaId = campoVinculoMateria.value;
  const turmaId = campoTurmaProfessor.value;
  const nomeMateria = campoVinculoMateria.selectedOptions[0].textContent;
  const nomeTurma = campoTurmaProfessor.selectedOptions[0].textContent;

  salvandoTurmaProfessor = true;
  campoVinculoMateria.disabled = true;
  campoTurmaProfessor.disabled = true;
  fecharTurmaProfessor.disabled = true;
  salvarTurmaProfessor.textContent = "Salvando...";
  mensagemTurmaProfessor.textContent = "";

  atualizarBotaoTurmaProfessor();

  try {
    const { data: vinculoId, error } = await supabase.rpc(
      "vincular_turma_professor",
      {
        p_professor_materia_id: vinculoMateriaId,
        p_turma_id: turmaId
      }
    );

    if (error) throw error;
    if (!vinculoId) throw new Error("Vínculo não confirmado.");

    mensagemTurmaProfessor.textContent =
      `Vínculo ativo: ${nomeMateria} — ${nomeTurma}.`;

    // Mantém a matéria para facilitar a inclusão de outra turma.
    campoTurmaProfessor.value = "";
    await carregarProfessores();
  } catch (erro) {
    console.error("Erro ao vincular turma:", erro);

    if (erro.code === "42501") {
      mensagemTurmaProfessor.textContent =
        "Operação não autorizada. Entre como coordenação ativa.";
    } else if (erro.code === "22023") {
      mensagemTurmaProfessor.textContent = erro.message;
    } else {
      mensagemTurmaProfessor.textContent =
        "Não foi possível confirmar o vínculo. Tente novamente; " +
        "a mesma combinação não será duplicada.";
    }
  } finally {
    salvandoTurmaProfessor = false;
    campoVinculoMateria.disabled = false;
    campoTurmaProfessor.disabled = false;
    fecharTurmaProfessor.disabled = false;
    salvarTurmaProfessor.textContent = "Vincular turma";

    atualizarBotaoTurmaProfessor();
  }
});