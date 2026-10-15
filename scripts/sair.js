import { supabase } from "./supabase.js";

const botaoSair = document.querySelector("#botao-sair");
let saindo = false;

botaoSair.addEventListener("click", async (evento) => {
  // Impede o link de trocar de página antes de encerrar a sessão.
  evento.preventDefault();

  if (saindo) return;

  saindo = true;
  const textoOriginal = botaoSair.textContent;
  botaoSair.textContent = "Saindo...";

  try {
    // Remove a inscrição local antes de sair de uma conta num aparelho compartilhado.
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const registro = await navigator.serviceWorker.getRegistration(new URL("../", import.meta.url));
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        await supabase.functions.invoke("notificacoes", { body: { acao: "remover", endpoint: inscricao.endpoint } });
        const removeu = await inscricao.unsubscribe();
        if (!removeu) throw new Error("Não foi possível desativar notificações neste aparelho.");
      }
    }
    const { error } = await supabase.auth.signOut({
      scope: "local"
    });

    if (error) throw error;

    // Considerando que o login está em index.html, na raiz.
    window.location.replace("../index.html");
  } catch {
    alert("Não foi possível sair. Tente novamente.");
  } finally {
    saindo = false;
    botaoSair.textContent = textoOriginal;
  }
});
