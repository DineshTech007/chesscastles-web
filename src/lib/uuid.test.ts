import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses crypto.randomUUID when the browser has it', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID');
    const id = uuid();
    expect(spy).toHaveBeenCalledOnce();
    expect(id).toMatch(V4);
  });

  it('without crypto.randomUUID (older phones), builds the same 36-character v4 format from getRandomValues', () => {
    const real = globalThis.crypto;
    const fake = { getRandomValues: real.getRandomValues.bind(real) } as Crypto;
    vi.stubGlobal('crypto', fake);
    try {
      const ids = Array.from({ length: 500 }, () => uuid());
      for (const id of ids) {
        expect(id).toHaveLength(36);
        expect(id).toMatch(V4);
      }
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sets the version and variant bits even when the random bytes are all 0 or all 255', () => {
    for (const fill of [0x00, 0xff]) {
      vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(fill) } as unknown as Crypto);
      try {
        expect(uuid()).toMatch(V4);
      } finally {
        vi.unstubAllGlobals();
      }
    }
  });
});
