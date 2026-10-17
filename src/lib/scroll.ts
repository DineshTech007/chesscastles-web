/**
 * Scrolls `box` (and only `box`, never the page) so that `el` inside it is
 * in view. `scrollIntoView` would also scroll the page, which made the
 * screen jump when stepping through moves with the arrow keys.
 */
export function revealIn(box: HTMLElement | undefined, el: Element | null | undefined, margin = 8) {
  if (!box || !el) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < b.top + margin) box.scrollTop -= b.top + margin - r.top;
  else if (r.bottom > b.bottom - margin) box.scrollTop += r.bottom - (b.bottom - margin);
}
