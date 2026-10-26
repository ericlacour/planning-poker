// Généré par ../generer.mjs. Un bouton porteur de data-go mène à l'écran que son clic produirait, dans la
// fenêtre entière (l'écran est affiché dans une iframe de planche).
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-go]');
  if (!target) return;
  event.preventDefault();
  window.top.location.href = new URL(target.dataset.go, location.href).href;
});
// Formulaire d'entrée : l'envoi suit le data-go du bouton principal.
document.addEventListener('submit', (event) => event.preventDefault());
