import { supabase } from "./supabase.js";

const status = document.querySelector("#status-pendencias");
const cartoes = [...document.querySelectorAll("[data-categoria]")];
const selos = new Map();
let carregando = false;
for (const cartao of cartoes) {
  const selo = document.createElement("span");
  selo.className = "pa-pendencias";
  // Marcação fixa; os números e rótulos vêm da consulta autenticada.
  selo.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span></span>';
  selo.setAttribute("role", "status");
  selo.hidden = true;
  cartao.append(selo);
  selos.set(cartao.dataset.categoria, selo);
}

async function carregarPendencias() {
  if (carregando || document.hidden) return;
  carregando = true;
  try {
    const { data, error } = await supabase.rpc("contar_assinaturas_pendentes_aluno");
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 3) throw new Error("Contagem inválida.");
    const valores = new Map(data.map((item) => [item.tipo, Number(item.quantidade)]));
    for (const tipo of selos.keys()) {
      if (!Number.isSafeInteger(valores.get(tipo)) || valores.get(tipo) < 0) throw new Error("Contagem inválida.");
    }
    for (const [tipo, selo] of selos) {
      const quantidade = valores.get(tipo);
      selo.querySelector("span").textContent = String(quantidade);
      selo.setAttribute("aria-label", `${quantidade} mensagem(ns) aguardando assinatura`);
      selo.title = `${quantidade} mensagem(ns) aguardando assinatura`;
      selo.hidden = quantidade === 0;
    }
    status.textContent = "";
  } catch {
    for (const selo of selos.values()) {
      selo.querySelector("span").textContent = "—";
      selo.hidden = false;
      selo.setAttribute("aria-label", "Contagem indisponível");
      selo.title = "Não foi possível consultar as pendências";
    }
    status.textContent = "Não foi possível consultar as assinaturas pendentes. As mensagens continuam disponíveis nos cartões.";
  } finally { carregando = false; }
}
carregarPendencias();
window.addEventListener("pageshow", (evento) => { if (evento.persisted) carregarPendencias(); });
window.addEventListener("focus", carregarPendencias);
document.addEventListener("visibilitychange", () => { if (!document.hidden) carregarPendencias(); });
// Atualiza mensagens novas enquanto o painel está aberto, sem push externo.
setInterval(carregarPendencias, 60000);
