import { supabase } from "./supabase.js";

// Estes caminhos partem da localização deste arquivo,
// que está dentro da pasta scripts.
const paginaLogin = new URL("../index.html", import.meta.url);

const paineis = new Map([
  ["coordenacao", "../coordenacao/coordenacao.html"],
  ["professor", "../professor/painel.professor.html"],
  ["aluno", "../aluno/painelAluno.html"]
]);

async function verificarAcesso() {
  document.body.removeAttribute("data-acesso");

  try {
    // 1. Confirma a conta conectada com o Supabase Auth.
    const {
      data: { user },
      error: erroUsuario
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {
      window.location.replace(paginaLogin.href);
      return;
    }

    // 2. Consulta o perfil dessa conta.
    const { data: perfil, error: erroPerfil } = await supabase
      .from("perfis")
      .select("perfil, ativo")
      .eq("id", user.id)
      .maybeSingle();

    if (erroPerfil) {
      throw new Error("Não foi possível consultar seu perfil.");
    }

    if (!perfil || !perfil.ativo) {
      alert("Sua conta não possui um perfil ativo.");
      window.location.replace(paginaLogin.href);
      return;
    }

    // 3. Compara o perfil da conta com o permitido na página.
    const perfilPermitido = document.body.dataset.perfil;

    if (perfil.perfil !== perfilPermitido) {
      const caminho = paineis.get(perfil.perfil);

      const destino = caminho
        ? new URL(caminho, import.meta.url)
        : paginaLogin;

      window.location.replace(destino.href);
      return;
    }

    // 4. Mostra o conteúdo apenas após a verificação.
    document.body.dataset.acesso = "liberado";

  } catch {
    alert(
      "Não foi possível verificar seu acesso. " +
      "Confira sua conexão e tente novamente."
    );

    window.location.replace(paginaLogin.href);
  }
}

// Esconde o conteúdo antes de a página ficar no histórico.
window.addEventListener("pagehide", () => {
  document.body.removeAttribute("data-acesso");
});

// Verifica novamente se o navegador restaurar a página pelo Voltar.
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) {
    verificarAcesso();
  }
});

// Se a sessão for encerrada, retorna ao login.
supabase.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT") {
    document.body.removeAttribute("data-acesso");
    window.location.replace(paginaLogin.href);
  }
});

verificarAcesso();