import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { validatePriorityList, validatePriorityLists } from './validation';

const champions = CATALOG.filter((entry) => entry.category === 'champion').map((entry) => entry.id);
const components = CATALOG.filter((entry) => entry.category === 'component').map((entry) => entry.id);

describe('priority validation', () => {
  it('accepts ten unique entries in priority order', () => {
    expect(validatePriorityList(champions.slice(0, 10), CATALOG)).toEqual({ ok: true, value: champions.slice(0, 10) });
  });

  it('rejects an eleventh entry and duplicates', () => {
    expect(validatePriorityList(champions.slice(0, 11), CATALOG)).toMatchObject({ ok: false, code: 'too_many' });
    expect(validatePriorityList([champions[0], champions[0]], CATALOG)).toMatchObject({ ok: false, code: 'duplicate' });
  });

  it('rejects unknown and wrong-category entries with their indexes', () => {
    expect(validatePriorityList(['not-in-catalog'], CATALOG)).toEqual({ ok: false, code: 'unknown', index: 0 });
    expect(validatePriorityLists({ champions: [components[0]], components: [] }, CATALOG)).toEqual({ ok: false, code: 'wrong_category', index: 0 });
  });

  it('accepts empty lists and preserves input order', () => {
    expect(validatePriorityList([], CATALOG)).toEqual({ ok: true, value: [] });
    const input = [champions[2], champions[0]];
    expect(validatePriorityList(input, CATALOG)).toEqual({ ok: true, value: input });
  });

  it('validates champion and component lists independently', () => {
    expect(validatePriorityLists({ champions: champions.slice(0, 2), components: components.slice(0, 2) }, CATALOG)).toEqual({
      ok: true,
      value: { champions: champions.slice(0, 2), components: components.slice(0, 2) },
    });
    expect(validatePriorityLists({ champions: [components[0]], components: [] }, CATALOG)).toMatchObject({ ok: false, code: 'wrong_category' });
  });
});
