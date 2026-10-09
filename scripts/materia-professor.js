import { supabase } from "./supabase.js";

const tituloMateria = document.querySelector("#titulo-materia");
const professorDaMateria = document.querySelector("#professor-da-materia");
const listaTurmas = document.querySelector("#lista-turmas-professor");
const mensagemTurmas = document.querySelector("#mensagem-turmas-professor");

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

async function carregarMateriaETurmas() {
  listaTurmas.replaceChildren();

  const parametros = new URLSearchParams(window.location.search);
  const vinculoId = parametros.get("vinculo");

  // Confere o formato do identificador recebido na URL.
  const formatoUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!vinculoId || !formatoUuid.test(vinculoId)) {
    tituloMateria.textContent = "Matéria não selecionada";
    professorDaMateria.textContent = "—";
    mensagemTurmas.textContent =
      "Volte ao painel e clique em uma das suas matérias.";
    return;
  }

  try {
    const { data: dadosAuth, error: erroAuth } =
      await supabase.auth.getUser();

    if (erroAuth) throw erroAuth;

    if (!dadosAuth.user) {
      tituloMateria.textContent = "Acesso necessário";
      professorDaMateria.textContent = "—";
      mensagemTurmas.textContent = "Entre na sua conta para continuar.";
      return;
    }

    // Localiza o cadastro do professor conectado.
    const { data: professor, error: erroProfessor } = await supabase
      .from("professores")
      .select("id, nome")
      .eq("usuario_id", dadosAuth.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (erroProfessor) throw erroProfessor;

    if (!professor) {
      tituloMateria.textContent = "Cadastro indisponível";
      professorDaMateria.textContent = "—";
      mensagemTurmas.textContent =
        "Não foi possível localizar seu cadastro. Procure a coordenação.";
      return;
    }

    professorDaMateria.textContent = professor.nome;

    // Busca o vínculo somente se pertencer a esse professor.
    const { data: vinculo, error: erroVinculo } = await supabase
      .from("professor_materias")
      .select(`
        id,
        materia:materias (
          nome,
          ativo
        ),
        professor_materia_turmas (
          id,
          ativo,
          turma:turmas (
            id,
            nome,
            ensino,
            periodo,
            ano_letivo,
            ativo
          )
        )
      `)
      .eq("id", vinculoId)
      .eq("professor_id", professor.id)
      .maybeSingle();

    if (erroVinculo) throw erroVinculo;

    if (!vinculo || !vinculo.materia?.ativo) {
      tituloMateria.textContent = "Matéria indisponível";
      mensagemTurmas.textContent =
        "Essa matéria não está disponível para sua conta. Volte ao painel.";
      return;
    }

    tituloMateria.textContent = vinculo.materia.nome;

    const turmasDisponiveis = (
      vinculo.professor_materia_turmas ?? []
    )
      .filter((item) => item.ativo && item.turma?.ativo)
      .sort((a, b) =>
        b.turma.ano_letivo - a.turma.ano_letivo ||
        a.turma.nome.localeCompare(b.turma.nome, "pt-BR")
      );

    if (turmasDisponiveis.length === 0) {
      mensagemTurmas.textContent =
        "Nenhuma turma ativa disponível para essa matéria. " +
        "Consulte a coordenação.";
      return;
    }

    for (const item of turmasDisponiveis) {
      const turma = item.turma;

      const cartao = document.createElement("a");
      cartao.className = "materia-turma";

      // Identifica a combinação professor, matéria e turma.
      const destino = new URLSearchParams({
        vinculo_turma: item.id
      });

      cartao.href = `turma-professor.html?${destino.toString()}`;

      const rotulo = document.createElement("span");
      rotulo.className = "materia-turma-rotulo";
      rotulo.textContent = "TURMA";

      const nomeTurma = document.createElement("h3");
      nomeTurma.textContent = turma.nome;

      const detalhes = document.createElement("p");
      detalhes.textContent =
        `${ensinos[turma.ensino] ?? turma.ensino} • ` +
        `${periodos[turma.periodo] ?? turma.periodo} • ` +
        `${turma.ano_letivo}`;

      const acessar = document.createElement("span");
      acessar.className = "materia-acessar";
      acessar.append("Acessar turma ");

      const seta = document.createElement("span");
      seta.setAttribute("aria-hidden", "true");
      seta.textContent = "→";

      acessar.append(seta);
      cartao.append(rotulo, nomeTurma, detalhes, acessar);
      listaTurmas.append(cartao);
    }

    mensagemTurmas.textContent = "";

  } catch (erro) {
    console.error("Erro ao carregar matéria e turmas:", erro);

    listaTurmas.replaceChildren();
    tituloMateria.textContent = "Não foi possível carregar a matéria";
    mensagemTurmas.textContent =
      "Atualize a página para tentar novamente.";
  }
}

carregarMateriaETurmas();