document.querySelectorAll("[data-mostrar-senha]").forEach((controle) => {
  const campo = document.getElementById(controle.dataset.mostrarSenha);
  if (!campo) return;

  function atualizar() {
    campo.type = controle.checked ? "text" : "password";
  }

  controle.addEventListener("change", atualizar);
  // Ao voltar à página, a senha começa oculta novamente.
  window.addEventListener("pageshow", () => {
    controle.checked = false;
    atualizar();
  });
  atualizar();
});
