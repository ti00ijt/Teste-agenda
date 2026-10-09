import { supabase } from "./supabase.js";

const tipos = ["tarefa", "aviso", "bilhete"];

async function carregarContador(tipo) {
  const elemento = document.querySelector(`#pendentes-${tipo}`);

  if (!elemento) {
    console.error(`Não foi encontrado o elemento pendentes-${tipo}.`);
    return;
  }

  elemento.textContent = "Carregando...";

  try {
    const { count, error } = await supabase
      .from("mensagens")
      .select("*", { count: "exact", head: true })
      .eq("status", "aguardando")
      .eq("tipo", tipo);

    if (error) throw error;

    if (count === null) {
      throw new Error("O banco não retornou a quantidade.");
    }

    elemento.textContent =
      count === 0
        ? "Nenhuma aguardando aprovação"
        : `${count} aguardando aprovação`;

  } catch (erro) {
    console.error(`Erro ao contar mensagens do tipo ${tipo}:`, erro);

    elemento.textContent = "Não foi possível carregar";
  }
}

async function carregarContadores() {
  await Promise.all(tipos.map(carregarContador));
}

carregarContadores();