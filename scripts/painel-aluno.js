import { supabase } from "./supabase.js";

const nomeAluno = document.querySelector("#nome-aluno-painel");
const mensagem = document.querySelector("#mensagem-painel");
const turmaAluno = document.querySelector("#turma-aluno-painel");
async function carregarAluno() {
  try {
    // Identifica a conta conectada.
    const { data: dadosAuth, error: erroAuth } =
      await supabase.auth.getUser();

    if (erroAuth) throw erroAuth;

    if (!dadosAuth.user) {
      nomeAluno.textContent = "visitante";
      mensagem.textContent = "Entre na sua conta para continuar.";
      turmaAluno.textContent = "";
      return;
    }

    // Busca o cadastro vinculado à conta.
    const { data: aluno, error: erroAluno } = await supabase
      .from("alunos")
      .select("id,nome")
      .eq("usuario_id", dadosAuth.user.id)
      .maybeSingle();

    if (erroAluno) throw erroAluno;

    if (!aluno) {
      nomeAluno.textContent = "aluno";
      mensagem.textContent =
        "Não foi possível localizar seu cadastro. Procure a secretaria.";
        turmaAluno.textContent = "";
      return;
    }

    // Exibe o nome como texto.
    nomeAluno.textContent = aluno.nome;
    mensagem.textContent = "";
    await carregarTurma(aluno.id);
  } catch (erro) {
    console.error("Erro ao carregar o aluno:", erro);
    turmaAluno.textContent = "";
    nomeAluno.textContent = "aluno";
    mensagem.textContent =
      "Não foi possível carregar seus dados. Tente atualizar a página.";
  }
}

carregarAluno();


async function carregarTurma(alunoId) {
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

  try {
    const { data: matricula, error } = await supabase
      .from("matriculas")
      .select(`
        id,
        turma:turmas (
          nome,
          ensino,
          periodo,
          ano_letivo
        )
      `)
      .eq("aluno_id", alunoId)
      .is("data_fim", null)
      .maybeSingle();

    if (error) throw error;

    if (!matricula) {
      turmaAluno.textContent = "Nenhuma matrícula atual encontrada.";
      return;
    }

    if (!matricula.turma) {
      turmaAluno.textContent =
        "Turma indisponível. Procure a secretaria.";
      return;
    }

    const turma = matricula.turma;

    turmaAluno.textContent =
      `${turma.nome} • ` +
      `${ensinos[turma.ensino] ?? turma.ensino} • ` +
      `${periodos[turma.periodo] ?? turma.periodo} • ` +
      `${turma.ano_letivo}`;

  } catch (erro) {
    console.error("Erro ao carregar a turma:", erro);

    turmaAluno.textContent =
      "Não foi possível carregar a turma. Atualize a página.";
  }
}