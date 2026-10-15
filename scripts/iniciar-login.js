const mensagem = document.querySelector("#mensagem-login");
const botao = document.querySelector("#botao-entrar");

// Mostra falhas de importação que impediriam o próprio login de executar.
const aviso = setTimeout(() => {
  if (botao.disabled && botao.textContent.trim() === "Carregando...") {
    mensagem.textContent = "O carregamento do login está demorando. Confira sua conexão e recarregue a página.";
  }
}, 15000);

try {
  await import("./login.js");
  mensagem.textContent = "";
} catch (erro) {
  console.error("Não foi possível carregar o módulo de login:", erro);
  botao.disabled = true;
  botao.textContent = "Login indisponível";
  mensagem.textContent = "Não foi possível carregar os arquivos do login. Recarregue a página. Se continuar, confira o erro no Console do navegador.";
} finally {
  clearTimeout(aviso);
}
