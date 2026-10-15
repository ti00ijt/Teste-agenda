import { supabase } from "./supabase.js";
//alert("O JavaScript de turmas carregou");//
const nome = document.querySelector("#nome-turma");
const ensino = document.querySelector("#ensino-turma");
const periodo = document.querySelector("#periodo-turma");
const ano = document.querySelector("#ano-turma");

const botao = document.querySelector("#adicionar-turma");
const mensagem = document.querySelector("#mensagem-turma");

let salvando = false;

// Preenche o ano atual como sugestão. Você pode alterá-lo.
ano.value = new Date().getFullYear();

// Torna todos os campos obrigatórios.
const campos = [nome, ensino, periodo, ano];

campos.forEach((campo) => {
  campo.required = true;
});

botao.addEventListener("click", async () => {
  if (salvando) return;

  mensagem.textContent = "";

  // Remove espaços extras do nome.
  nome.value = nome.value.trim().replace(/\s+/g, " ");

  // Confere os campos antes de enviar.
  for (const campo of campos) {
    if (!campo.reportValidity()) {
      return;
    }
  }

  const dadosTurma = {
    nome: nome.value,
    ensino: ensino.value,
    periodo: periodo.value,
    ano_letivo: Number(ano.value)
  };

  salvando = true;
  botao.disabled = true;

  const textoOriginal = botao.textContent;
  botao.textContent = "Salvando...";

  try {
    // Envia os dados para a tabela turmas.
    const { error } = await supabase
      .from("turmas")
      .insert(dadosTurma);

    if (error) {
      console.error("Erro ao cadastrar turma:", {
        codigo: error.code,
        mensagem: error.message
      });

      if (error.code === "23505") {
        mensagem.textContent =
          "Essa turma já está cadastrada para esse ensino, período e ano.";
      } else if (error.code === "42501") {
        mensagem.textContent =
          "Cadastro não autorizado. Confira se você entrou como coordenação ativa.";
      } else {
        mensagem.textContent =
          "Não foi possível cadastrar. Confira o erro no Console.";
      }

      return;
    }

    mensagem.textContent =
      `Turma ${dadosTurma.nome} cadastrada com sucesso!`;

    // Limpa apenas o nome para facilitar o próximo cadastro.
    nome.value = "";
    nome.focus();
    await carregarTurmas();

  } catch {
    mensagem.textContent =
      "Não foi possível confirmar o cadastro. Confira sua conexão e a tabela no Supabase antes de repetir.";
  } finally {
    salvando = false;
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});
const listaTurmas = document.querySelector("#lista-turmas");
const contadorTurmas = document.querySelector("#contador-turmas");
const mensagemLista = document.querySelector("#mensagem-lista-turmas");

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

function criarCelula(texto) {
  const celula = document.createElement("td");
  celula.textContent = texto;
  return celula;
}

async function carregarTurmas() {
  // Confere se os elementos necessários existem no HTML.
  if (!listaTurmas || !contadorTurmas || !mensagemLista) {
    console.error(
      "Confira os IDs no HTML: lista-turmas, " +
      "contador-turmas e mensagem-lista-turmas."
    );
    return;
  }

  mensagemLista.textContent = "Carregando turmas...";
  contadorTurmas.textContent = "…";
  listaTurmas.replaceChildren();

  try {
    const { data: turmas, error } = await supabase
      .from("turmas")
      .select("id, nome, ensino, periodo, ano_letivo")
      .eq("ativo", true)
      .order("ano_letivo", { ascending: false })
      .order("nome", { ascending: true });

    if (error) throw error;

    contadorTurmas.textContent =
      `${turmas.length} ${turmas.length === 1 ? "turma" : "turmas"}`;

    if (turmas.length === 0) {
      mensagemLista.textContent = "Nenhuma turma ativa cadastrada.";
      return;
    }

    const linhas = document.createDocumentFragment();

    for (const turma of turmas) {
      const linha = document.createElement("tr");

      const celulaNome = document.createElement("th");
      celulaNome.scope = "row";
      celulaNome.textContent = `${turma.nome} — ${turma.ano_letivo}`;

      const celulaAcao = document.createElement("td");

      const botaoArquivar = document.createElement("button");
      botaoArquivar.type = "button";
      botaoArquivar.className = "cadturma-excluir";
      botaoArquivar.textContent = "Arquivar";

      botaoArquivar.setAttribute(
        "aria-label",
        `Arquivar turma ${turma.nome} de ${turma.ano_letivo}`
      );

      botaoArquivar.addEventListener("click", () => {
        arquivarTurma(turma, botaoArquivar);
      });

      celulaAcao.append(botaoArquivar);

      linha.append(
        celulaNome,
        criarCelula(nomesEnsino[turma.ensino] ?? turma.ensino),
        criarCelula(nomesPeriodo[turma.periodo] ?? turma.periodo),
        celulaAcao
      );

      linhas.append(linha);
    }

    listaTurmas.append(linhas);
    mensagemLista.textContent = "";

  } catch (erro) {
    console.error("Erro ao carregar turmas:", {
      codigo: erro.code,
      mensagem: erro.message
    });

    contadorTurmas.textContent = "Indisponível";
    mensagemLista.textContent =
      "Não foi possível carregar a lista. Confira o Console.";
  }
}

// Busca as turmas assim que a página abre.
carregarTurmas();


async function arquivarTurma(turma, botaoArquivar) {
  const confirmou = window.confirm(
    `Arquivar ${turma.nome} — ${turma.ano_letivo}?\n\n` +
    "A turma sairá da lista de ativas, mas continuará no banco."
  );

  if (!confirmou) return;

  botaoArquivar.disabled = true;
  botaoArquivar.textContent = "Arquivando...";
  mensagem.textContent = "";

  try {
    const { data, error } = await supabase
      .from("turmas")
      .update({ ativo: false })
      .eq("id", turma.id)
      .eq("ativo", true)
      .select("id");

    if (error) throw error;

    // Não informa sucesso se nenhuma linha foi alterada.
    if (!data || data.length !== 1) {
      mensagem.textContent =
        "Nenhuma turma foi alterada. Ela pode já estar arquivada ou seu acesso pode ter mudado.";

      await carregarTurmas();
      return;
    }

    mensagem.textContent =
      `Turma ${turma.nome} arquivada com sucesso.`;

    await carregarTurmas();

  } catch (erro) {
    console.error("Erro ao arquivar turma:", {
      codigo: erro.code,
      mensagem: erro.message
    });

    mensagem.textContent =
      "Não foi possível confirmar o arquivamento. Recarregue a lista e confira antes de tentar novamente.";

  } finally {
    botaoArquivar.disabled = false;
    botaoArquivar.textContent = "Arquivar";
  }
}