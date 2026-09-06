import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

describe('catalog', () => {
  it('contains unique stable ids and both categories', () => {
    const ids = CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CATALOG.some((entry) => entry.category === 'champion')).toBe(true);
    expect(CATALOG.some((entry) => entry.category === 'component')).toBe(true);
  });

  it('includes the known initial entries', () => {
    expect(CATALOG).toEqual(expect.arrayContaining([
      { id: 'ahri', name: 'Ahri', category: 'champion', icon: 'ahri' },
      { id: 'bf-sword', name: 'B.F. Sword', category: 'component', icon: 'bf-sword' },
    ]));
  });
});
