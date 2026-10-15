import { supabase } from "./supabase.js?v=20261015-2";

export async function cadastrarComAcesso(dados) {
  const { data, error } = await supabase.functions.invoke("cadastrar-usuario", { body: dados });
  if (error) {
    let texto = "Não foi possível confirmar o cadastro. Confira a conta e o cadastro no Supabase antes de repetir.";
    if (error.context instanceof Response) {
      const resposta = await error.context.json().catch(() => null);
      if (typeof resposta?.erro === "string") texto = resposta.erro;
      else if (error.context.status === 401) texto = "Acesso recusado. Confira Verify JWT da função cadastrar-usuario e entre novamente na conta.";
      else if (error.context.status === 404) texto = "Publique a função cadastrar-usuario no Supabase antes de cadastrar.";
    } else if (error.name === "FunctionsFetchError") {
      texto = "Não foi possível acessar cadastrar-usuario. Confira a conexão e a publicação da função; confira o cadastro antes de repetir.";
    }
    throw new Error(texto);
  }
  if (!data?.cadastro_id) throw new Error("Cadastro não confirmado. Confira o Supabase antes de repetir.");
  return data;
}
