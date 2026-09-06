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

  it('contains the exact 64-champion playable Set 15 snapshot roster', () => {
    const expected = 'aatrox ahri akali ashe braum caitlyn darius dr-mundo ezreal gangplank garen gnar gwen janna jarvan-iv jayce jhin jinx kai-sa karma kalista katarina kayle kennen kobuko kog-maw ksante lee-sin leona lucian lulu lux malphite malzahar naafiri neeko poppy rakan rell rammus ryze samira senna seraphine sett shen sivir smolder swain syndra twisted-fate udyr varus vi viego volibear xayah xin-zhao yasuo yone yuumi zac zyra ziggs'.split(' ');
    expect(CATALOG.filter((entry) => entry.category === 'champion')).toHaveLength(64);
    expect(CATALOG.filter((entry) => entry.category === 'champion').map((entry) => entry.id).sort()).toEqual(expected.sort());
  });
});
