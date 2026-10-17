/** A chess clock: h:mm:ss, m:ss, or s.t under a minute. */
export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 60_000) {
    const s = Math.floor(t / 1000);
    const tenths = Math.floor((t % 1000) / 100);
    return `0:${String(s).padStart(2, '0')}.${tenths}`;
  }
  const total = Math.ceil(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export const thousands = (n: number) => n.toLocaleString('en-IN');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
