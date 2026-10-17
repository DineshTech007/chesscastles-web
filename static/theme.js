// Applies the saved theme before the first paint (no flash). A file, not an
// inline script, so the Content Security Policy can allow scripts from this site only.
try {
  const t = localStorage.getItem('k24.theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {}
