import { supabase } from "./supabase.js";

// Localiza os elementos da tela.
const formulario = document.querySelector("#form-login");
const campoLogin = document.querySelector("#login");
const campoSenha = document.querySelector("#senha");
const botao = document.querySelector("#botao-entrar");
const mensagem = document.querySelector("#mensagem-login");

// Caminhos relativos à página de login.
const paginas = new Map([
  ["coordenacao", "coordenacao/coordenacao.html"],
  ["professor", "professor/painel.professor.html"],
  ["aluno", "aluno/painelAluno.html"]
]);

let enviando = false;

// O JavaScript carregou: podemos liberar o botão.
botao.disabled = false;
botao.textContent = "Entrar";

formulario.addEventListener("submit", async (evento) => {
  // Evita que o navegador recarregue a página.
  evento.preventDefault();

  if (enviando) return;

  enviando = true;
  botao.disabled = true;
  botao.textContent = "Entrando...";
  mensagem.textContent = "";

  let autenticou = false;

  try {
    const identificador = campoLogin.value.trim();

    const email = identificador.includes("@")
      ? identificador
      : `aluno.${identificador}@agenda.invalid`;

    // A senha não recebe trim: espaços podem fazer parte dela.
    const password = campoSenha.value;

    // 1. Confere as credenciais no Supabase Auth.
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password: campoSenha.value
      });

    if (error) {
      if (error) {
      console.error("Falha no login:", {
        codigo: error.code,
        mensagem: error.message,
        status: error.status
      });

      mensagem.textContent =
        "Não foi possível entrar. Confira os detalhes no Console.";
      return;
}
    }

    autenticou = true;

    // 2. Busca o perfil vinculado à conta autenticada.
    const {
      data: perfil,
      error: erroPerfil
    } = await supabase
      .from("perfis")
      .select("perfil, ativo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (erroPerfil) {
      throw new Error(
        "Não foi possível consultar seu perfil. Tente novamente."
      );
    }

    // A RLS também impede a leitura de perfis inativos.
    if (!perfil || !perfil.ativo) {
      throw new Error(
        "Sua conta não possui um perfil ativo. Procure a coordenação."
      );
    }

    // 3. Escolhe a página correspondente ao perfil.
    const destino = paginas.get(perfil.perfil);

    if (!destino) {
      throw new Error(
        "O perfil desta conta não possui um painel configurado."
      );
    }

    campoSenha.value = "";

    // 4. Abre o painel.
    window.location.replace(destino);

  } catch (erro) {
    // Se o login funcionou, mas o perfil falhou,
    // encerra a sessão neste navegador.
    if (autenticou) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Mantém a mensagem do problema original.
      }
    }

    mensagem.textContent =
      erro instanceof Error
        ? erro.message
        : "Ocorreu um problema ao entrar. Tente novamente.";

  } finally {
    campoSenha.value = "";
    enviando = false;
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});