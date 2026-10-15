// Recebe notificações; não armazena páginas ou dados escolares em cache.
self.addEventListener("push", (evento) => {
  evento.waitUntil(self.registration.showNotification("Agenda escolar", {
    body: "Você tem uma nova notificação na agenda.",
    icon: new URL("imagens/img.png", self.registration.scope).href,
    tag: "agenda-novidades",
    data: { url: new URL("aluno/painelAluno.html", self.registration.scope).href },
  }));
});
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL("aluno/painelAluno.html", self.registration.scope).href;
  evento.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (janelas) => {
    const aberta = janelas.find((janela) => janela.url === destino);
    if (aberta) return aberta.focus();
    return self.clients.openWindow(destino);
  }));
});
