import { supabase } from "./supabase.js";

const tituloTurma = document.querySelector("#titulo-turma");
const identificacao = document.querySelector("#identificacao-professor-turma");
const detalhesTurma = document.querySelector("#detalhes-turma");
const mensagemAcesso = document.querySelector("#mensagem-acesso-turma");
const opcoesTurma = document.querySelector("#opcoes-turma");
const escreverMensagem = document.querySelector("#escrever-mensagem");
const historicoMensagens = document.querySelector(
  "#historico-mensagens-turma"
);

const quantidadeMensagens = document.querySelector(
  "#quantidade-mensagens"
);
function mostrarIndisponivel(texto) {
  tituloTurma.textContent = "Turma indisponível";
  identificacao.textContent = "";
  detalhesTurma.textContent = "";
  mensagemAcesso.textContent = texto;
  opcoesTurma.hidden = true;
  escreverMensagem.removeAttribute("href");
}

async function carregarTurmaSelecionada() {
  opcoesTurma.hidden = true;
  escreverMensagem.removeAttribute("href");

  const parametros = new URLSearchParams(window.location.search);
  const vinculoTurmaId = parametros.get("vinculo_turma");

  const formatoUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!vinculoTurmaId || !formatoUuid.test(vinculoTurmaId)) {
    mostrarIndisponivel(
      "Volte ao painel, escolha uma matéria e depois uma turma."
    );
    return;
  }

  try {
    // Identifica a conta conectada.
    const { data: dadosAuth, error: erroAuth } =
      await supabase.auth.getUser();

    if (erroAuth) throw erroAuth;

    if (!dadosAuth.user) {
      mostrarIndisponivel("Entre na sua conta para continuar.");
      return;
    }

    // Localiza o cadastro do professor.
    const { data: professor, error: erroProfessor } = await supabase
      .from("professores")
      .select("id, nome")
      .eq("usuario_id", dadosAuth.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (erroProfessor) throw erroProfessor;

    if (!professor) {
      mostrarIndisponivel(
        "Seu cadastro não está disponível. Procure a coordenação."
      );
      return;
    }

    // Busca a combinação professor, matéria e turma.
    const { data: vinculo, error: erroVinculo } = await supabase
      .from("professor_materia_turmas")
      .select(`
        id,
        turma:turmas (
          id,
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
      mostrarIndisponivel(
        "Essa turma não está disponível para você nessa matéria. " +
        "Volte ao painel ou consulte a coordenação."
      );
      return;
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

    tituloTurma.textContent = turma.nome;

    identificacao.textContent =
      `${materia.nome} • Professor(a): ${professor.nome}`;

    detalhesTurma.textContent =
      `${ensinos[turma.ensino] ?? turma.ensino} • ` +
      `${periodos[turma.periodo] ?? turma.periodo} • ` +
      `${turma.ano_letivo}`;

    // Leva a mesma combinação para a página de escrita.
    const destino = new URLSearchParams({
      vinculo_turma: vinculo.id
    });

    escreverMensagem.href =
      `nova-mensagem.html?${destino.toString()}`;

    mensagemAcesso.textContent = "";
    opcoesTurma.hidden = false;
    await carregarHistoricoTurma(vinculo.id, dadosAuth.user.id);

  } catch (erro) {
    console.error("Erro ao carregar a turma selecionada:", erro);

    mostrarIndisponivel(
      "Não foi possível carregar os dados. Atualize a página."
    );
  }
}

function mostrarAvisoHistorico(texto) {
  historicoMensagens.replaceChildren();

  const linha = document.createElement("tr");
  const celula = document.createElement("td");

  celula.colSpan = 5;
  celula.textContent = texto;

  linha.append(celula);
  historicoMensagens.append(linha);
}

async function carregarHistoricoTurma(vinculoId, autorId) {
  quantidadeMensagens.textContent = "—";
  mostrarAvisoHistorico("Carregando mensagens...");

  try {
    const { data: mensagens, error } = await supabase
      .from("mensagens")
      .select("id, criado_em, tipo, destino, titulo, conteudo, status")
      .eq("vinculo_turma_id", vinculoId)
      .eq("autor_id", autorId)
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    if (error) throw error;

    quantidadeMensagens.textContent =
      `${mensagens.length} mensagem(ns) exibida(s)`;

    if (mensagens.length === 0) {
      mostrarAvisoHistorico(
        "Você ainda não enviou mensagens para esta turma nesta matéria."
      );
      return;
    }

    const tipos = {
      aviso: "Aviso",
      tarefa: "Tarefa",
      bilhete: "Bilhete"
    };

    const statusDisponiveis = {
      aguardando: {
        texto: "Aguardando aprovação",
        classe: "status-aguardando"
      },
      aprovado: {
        texto: "Aprovado",
        classe: "status-aprovado"
      },
      reprovado: {
        texto: "Reprovado",
        classe: "status-reprovado"
      }
    };

    const formatoData = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const formatoHora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit"
    });

    historicoMensagens.replaceChildren();

    for (const mensagem of mensagens) {
      const linha = document.createElement("tr");

      // Data e hora.
      const celulaData = document.createElement("td");
      const data = new Date(mensagem.criado_em);
      const horario = document.createElement("time");

      horario.dateTime = data.toISOString();
      horario.append(formatoData.format(data));

      const hora = document.createElement("span");
      hora.className = "turma-hora";
      hora.textContent = formatoHora.format(data);

      horario.append(hora);
      celulaData.append(horario);

      // Tipo.
      const celulaTipo = document.createElement("td");
      celulaTipo.textContent = tipos[mensagem.tipo] ?? mensagem.tipo;

      // Destino: os nomes dos alunos serão conectados depois.
      const celulaDestino = document.createElement("td");

      const destino = document.createElement("strong");
      destino.className = "turma-destino";
      destino.textContent =
        mensagem.destino === "geral" ? "Geral" : "Individual";

      const detalheDestino = document.createElement("span");
      detalheDestino.className = "turma-destino-detalhe";
      detalheDestino.textContent =
        mensagem.destino === "geral"
          ? "Alunos matriculados no momento do envio"
          : "Alunos selecionados";

      celulaDestino.append(destino, detalheDestino);

      // Título e resumo.
      const celulaMensagem = document.createElement("td");

      const titulo = document.createElement("strong");
      titulo.className = "turma-assunto";
      titulo.textContent = mensagem.titulo;

      const resumo = document.createElement("p");
      resumo.className = "turma-resumo";

      const conteudo = mensagem.conteudo.replace(/\s+/g, " ").trim();

      resumo.textContent =
        conteudo.length > 160
          ? `${conteudo.slice(0, 160)}…`
          : conteudo;

      celulaMensagem.append(titulo, resumo);

      // Status.
      const celulaStatus = document.createElement("td");
      const selo = document.createElement("span");

      const status = statusDisponiveis[mensagem.status];

      selo.className = "turma-status";
      selo.textContent = status?.texto ?? "Status indisponível";

      if (status) selo.classList.add(status.classe);

      celulaStatus.append(selo);

      linha.append(
        celulaData,
        celulaTipo,
        celulaDestino,
        celulaMensagem,
        celulaStatus
      );

      historicoMensagens.append(linha);
    }
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);

    quantidadeMensagens.textContent = "—";

    mostrarAvisoHistorico(
      "Não foi possível carregar as mensagens. Atualize a página."
    );
  }
}
carregarTurmaSelecionada();
