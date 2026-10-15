import { supabase } from "./supabase.js?v=20261015-2";

let janela;
let destino;
let enviando = false;
let formulario, identificacao, senha, confirmacao, mostrar, mensagem, salvar, fechar;

function criarJanela() {
  janela = document.createElement("dialog");
  janela.className = "senha-dialogo";
  janela.setAttribute("aria-labelledby", "titulo-redefinir-senha");
  // Apenas marcação fixa; nomes de usuários são inseridos com textContent.
  janela.innerHTML = `
    <h2 id="titulo-redefinir-senha">Redefinir senha</h2>
    <p id="conta-redefinir-senha"></p>
    <p>A senha atual será substituída. Entregue a nova senha à família ou ao professor.</p>
    <form id="form-redefinir-senha">
      <label for="nova-senha">Nova senha</label>
      <input id="nova-senha" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
      <label for="confirmar-nova-senha">Confirmar nova senha</label>
      <input id="confirmar-nova-senha" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
      <label class="senha-mostrar"><input id="mostrar-nova-senha" type="checkbox" aria-controls="nova-senha confirmar-nova-senha"> Mostrar senhas</label>
      <p id="resultado-redefinir-senha" role="status" aria-live="polite"></p>
      <div class="senha-acoes">
        <button id="fechar-redefinir-senha" type="button">Cancelar</button>
        <button id="salvar-nova-senha" type="submit">Salvar nova senha</button>
      </div>
    </form>`;
  document.body.append(janela);
  formulario = janela.querySelector("form");
  identificacao = janela.querySelector("#conta-redefinir-senha");
  senha = janela.querySelector("#nova-senha");
  confirmacao = janela.querySelector("#confirmar-nova-senha");
  mostrar = janela.querySelector("#mostrar-nova-senha");
  mensagem = janela.querySelector("#resultado-redefinir-senha");
  salvar = janela.querySelector("#salvar-nova-senha");
  fechar = janela.querySelector("#fechar-redefinir-senha");
  mostrar.addEventListener("change", () => {
    senha.type = confirmacao.type = mostrar.checked ? "text" : "password";
  });
  confirmacao.addEventListener("input", () => confirmacao.setCustomValidity(""));
  senha.addEventListener("input", () => confirmacao.setCustomValidity(""));
  fechar.addEventListener("click", () => { if (!enviando) janela.close(); });
  janela.addEventListener("cancel", (evento) => { if (enviando) evento.preventDefault(); });
  janela.addEventListener("close", () => {
    formulario.reset();
    senha.type = confirmacao.type = "password";
    confirmacao.setCustomValidity("");
    destino = null;
  });
  window.addEventListener("pagehide", () => { senha.value = confirmacao.value = ""; });
  formulario.addEventListener("submit", enviar);
}

async function enviar(evento) {
  evento.preventDefault();
  if (enviando || !destino) return;
  confirmacao.setCustomValidity(senha.value === confirmacao.value ? "" : "As senhas precisam ser iguais.");
  if (!formulario.reportValidity()) return;
  enviando = true;
  for (const controle of formulario.elements) controle.disabled = true;
  mensagem.textContent = "Atualizando a senha...";
  try {
    const { data, error } = await supabase.functions.invoke("redefinir-senha", {
      body: { tipo: destino.tipo, cadastro_id: destino.id, senha: senha.value },
    });
    if (error) {
      let texto = "Não foi possível confirmar. Teste a nova senha antes de tentar novamente.";
      if (error.context instanceof Response) {
        const resposta = await error.context.json().catch(() => null);
        if (typeof resposta?.erro === "string") texto = resposta.erro;
        else if (error.context.status === 401) texto = "Entre novamente na conta da coordenação e confira Verify JWT da função redefinir-senha.";
        else if (error.context.status === 404) texto = "A função redefinir-senha precisa ser publicada no Supabase.";
      }
      throw new Error(texto);
    }
    if (!data?.sucesso) throw new Error("O servidor não confirmou a alteração. Teste a nova senha antes de repetir.");
    mensagem.textContent = "Senha atualizada com sucesso. Entregue a nova senha ao responsável pela conta.";
    salvar.hidden = true;
    fechar.textContent = "Fechar";
  } catch (erro) {
    mensagem.textContent = erro.message || "Não foi possível confirmar a alteração.";
  } finally {
    senha.value = confirmacao.value = "";
    mostrar.checked = false;
    senha.type = confirmacao.type = "password";
    enviando = false;
    for (const controle of formulario.elements) controle.disabled = false;
    if (salvar.hidden) senha.disabled = confirmacao.disabled = mostrar.disabled = true;
  }
}

export function criarBotaoRedefinirSenha(tipo, cadastro) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "senha-redefinir";
  botao.textContent = "Redefinir senha";
  botao.setAttribute("aria-label", `Redefinir senha de ${cadastro.nome}`);
  botao.addEventListener("click", () => {
    if (enviando) return;
    if (!janela) criarJanela();
    destino = { tipo, id: cadastro.id };
    formulario.reset();
    for (const controle of formulario.elements) controle.disabled = false;
    salvar.hidden = false;
    fechar.textContent = "Cancelar";
    mensagem.textContent = "Use uma senha exclusiva de 8 a 128 caracteres.";
    identificacao.textContent = `${cadastro.nome} — ${tipo === "aluno" ? "RA" : "Código"}: ${cadastro.ra ?? cadastro.codigo}`;
    janela.showModal();
    senha.focus();
  });
  return botao;
}
