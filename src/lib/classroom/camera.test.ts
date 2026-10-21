import { afterEach, describe, expect, it, vi } from 'vitest';
import { cameraTrouble } from './live.svelte';

const err = (name: string) => Object.assign(new Error(name), { name });

describe('why the camera did not start (owner, 2026-10-22)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('a page from before the update that allows cameras: reload', () => {
    vi.stubGlobal('document', { permissionsPolicy: { allowsFeature: (f: string) => f !== 'camera' } });
    expect(cameraTrouble(err('NotAllowedError'))).toMatch(/reload/i);
  });
  it('each browser error says what to do', () => {
    vi.stubGlobal('document', { permissionsPolicy: { allowsFeature: () => true } });
    expect(cameraTrouble(err('NotAllowedError'))).toMatch(/blocked.*address bar/);
    expect(cameraTrouble(err('NotReadableError'))).toMatch(/Another app is using the camera/);
    expect(cameraTrouble(err('NotFoundError'))).toMatch(/No camera/);
    expect(cameraTrouble(err('WeirdError'))).toMatch(/WeirdError/);
  });
});
