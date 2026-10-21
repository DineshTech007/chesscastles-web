/**
 * A random UUID (version 4, the standard 36 characters: "1b4e28ba-2fa1-41d2-883f-0016d3cca427"), as game ids are
 * stored. crypto.randomUUID where the browser has it; older phones' Chrome (before 92, or a page not on HTTPS)
 * doesn't, and starting a game failed there ("crypto.randomUUID is not a function"), so the same format is built
 * from crypto.getRandomValues instead.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx (RFC 4122)
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
