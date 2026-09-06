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

  it('contains the complete 67-champion Set 15 snapshot roster', () => {
    expect(CATALOG.filter((entry) => entry.category === 'champion')).toHaveLength(67);
    expect(CATALOG.map((entry) => entry.id)).toEqual(expect.arrayContaining(['aatrox', 'ahri', 'ekko', 'zyra', 'zac']));
  });
});
