// Standalone behaviour for 404.html / 500.html. The Next.js app renders the
// same markup through app/_status/status-document.tsx and does this itself.
for (const node of document.querySelectorAll('[data-status-path]')) {
  node.textContent = window.location.pathname;
}

for (const link of document.querySelectorAll('[data-status-retry]')) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.reload();
  });
}
