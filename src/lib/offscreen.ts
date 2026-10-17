/**
 * `use:offscreen`: marks an element `data-off` while it is out of view, so its
 * CSS animations can pause there (each frame of an SVG animation costs a layout).
 */
export function offscreen(el: Element) {
  if (typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) el.removeAttribute('data-off');
    else el.setAttribute('data-off', '');
  });
  io.observe(el);
  return { destroy: () => io.disconnect() };
}
