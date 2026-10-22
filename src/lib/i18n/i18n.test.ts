import { describe, expect, it } from 'vitest';
import { en } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { FEATURE_WORDS } from './index';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translations', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];
  it('Hindi and Marathi have every key, with the same {values} as English', () => {
    for (const k of keys) {
      for (const [name, d] of [['hi', hi], ['mr', mr]] as const) {
        expect(d[k], `${name} ${k}`).toBeTypeOf('string');
        if (k !== 'co.note') expect(d[k].trim().length, `${name} ${k} is empty`).toBeGreaterThan(0);
        expect(vars(d[k]), `${name} ${k} values`).toBe(vars(en[k]));
      }
    }
  });
  it('has no key that English lacks', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(mr).sort()).toEqual(Object.keys(en).sort());
  });
  it('keeps the page names and chess words recognisable', () => {
    expect(hi['nav.blog']).toBe('Blogs और Forum');
    expect(mr['nav.blog']).toBe('Blogs आणि Forum');
    expect(hi['hero.fide.f2']).toBe(en['hero.fide.f2']);
  });
});

describe('feature words (features/*.ts)', () => {
  it('Hindi and Marathi have every key, not empty, with the same {values}, and no key twice across the site', () => {
    const seen = new Set(Object.keys(en));
    for (const f of FEATURE_WORDS) {
      for (const k of Object.keys(f.en)) {
        expect(seen.has(k), `${k} is used twice`).toBe(false);
        seen.add(k);
        for (const [name, d] of [['hi', f.hi], ['mr', f.mr]] as const) {
          const v = (d as Record<string, string>)[k];
          expect(v, `${name} ${k}`).toBeTypeOf('string');
          expect(v.trim().length, `${name} ${k} is empty`).toBeGreaterThan(0);
          expect(vars(v), `${name} ${k} values`).toBe(vars((f.en as Record<string, string>)[k]));
        }
      }
    }
  });
});
