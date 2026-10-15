import { supabase } from "./supabase.js";

const nomeProfessor = document.querySelector("#nome-professor-painel");
const mensagemPainel = document.querySelector(
  "#mensagem-painel-professor"
);

const listaMateriasProfessor = document.querySelector(
  "#lista-materias-professor"
);

const mensagemMateriasProfessor = document.querySelector(
  "#mensagem-materias-professor"
);

async function carregarProfessor() {
  try {
    // Identifica a conta conectada.
    const { data: dadosAuth, error: erroAuth } =
      await supabase.auth.getUser();

    if (erroAuth) throw erroAuth;

    if (!dadosAuth.user) {
      nomeProfessor.textContent = "visitante";
      mensagemPainel.textContent =
      mensagemMateriasProfessor.textContent = "";
        "Entre na sua conta para continuar.";
      return;
    }

    // Busca o cadastro vinculado à conta.
    const { data: professor, error: erroProfessor } = await supabase
      .from("professores")
      .select("id, nome")
      .eq("usuario_id", dadosAuth.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (erroProfessor) throw erroProfessor;

    if (!professor) {
      nomeProfessor.textContent = "professor";
      mensagemPainel.textContent =
        "Cadastro não localizado ou indisponível. Procure a coordenação.";
        mensagemMateriasProfessor.textContent = "";
      return;
    }

    nomeProfessor.textContent = professor.nome;
    mensagemPainel.textContent = "";
    await carregarMateriasProfessor(professor.id);

  } catch (erro) {
    console.error("Erro ao carregar o professor:", erro);

    nomeProfessor.textContent = "professor";
    mensagemPainel.textContent =
      "Não foi possível carregar seus dados. Atualize a página.";
  }
}

carregarProfessor();

async function carregarMateriasProfessor(professorId) {
  listaMateriasProfessor.replaceChildren();
  mensagemMateriasProfessor.textContent = "Carregando matérias...";

  try {
    const { data: vinculos, error } = await supabase
      .from("professor_materias")
      .select(`
        id,
        materia:materias (
          id,
          nome,
          ativo
        )
      `)
      .eq("professor_id", professorId);

    if (error) throw error;

    const materiasDisponiveis = vinculos
      .filter((vinculo) => vinculo.materia?.ativo)
      .sort((a, b) =>
        a.materia.nome.localeCompare(b.materia.nome, "pt-BR")
      );

    if (materiasDisponiveis.length === 0) {
      mensagemMateriasProfessor.textContent =
        "Nenhuma matéria disponível. Consulte a coordenação.";
      return;
    }

    materiasDisponiveis.forEach((vinculo, indice) => {
      const cartao = document.createElement("a");
      cartao.className = "prof-materia";

      // Leva o ID do vínculo professor–matéria para a próxima página.
      const parametros = new URLSearchParams({
        vinculo: vinculo.id
      });

      cartao.href = `materia-professor.html?${parametros.toString()}`;

      const numero = document.createElement("span");
      numero.className = "prof-numero";
      numero.setAttribute("aria-hidden", "true");
      numero.textContent = String(indice + 1).padStart(2, "0");

      const titulo = document.createElement("h3");
      titulo.textContent = vinculo.materia.nome;

      const acessar = document.createElement("span");
      acessar.className = "prof-acessar";
      acessar.append("Acessar matéria ");

      const seta = document.createElement("span");
      seta.setAttribute("aria-hidden", "true");
      seta.textContent = "→";

      acessar.append(seta);
      cartao.append(numero, titulo, acessar);
      listaMateriasProfessor.append(cartao);
    });

    mensagemMateriasProfessor.textContent = "";

  } catch (erro) {
    console.error("Erro ao carregar matérias do professor:", erro);

    mensagemMateriasProfessor.textContent =
      "Não foi possível carregar suas matérias. Atualize a página.";
  }
}