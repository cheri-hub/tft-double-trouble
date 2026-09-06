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
      { id: 'ahri', name: 'Ahri', category: 'champion', icon: '/catalog/champions/ahri.png' },
      { id: 'bf-sword', name: 'B.F. Sword', category: 'component', icon: '/catalog/components/bf-sword.png' },
    ]));
  });

  it('contains the exact 65-unit playable Set 18 patch 16.17 snapshot roster', () => {
    const expected = 'ahri akali alistar alune amumu aphelios ashe azir brambleback caitlyn camille cassiopeia cinderling diana draven elder-dragon elise ezreal fiddlesticks gnar gromp hecarim ivern karma kayle kennen kha-zix kobuko kog-maw krug leblanc leona lillia lux malphite mama-beak maokai master-yi morgana murkwolf nidalee ornn pebbles rakan rammus rek-sai rengar scuttlecrab sejuani sentinel sett shen sivir soraka taric teemo tristana varus veigar vi warwick xayah yorick yunara zyra'.split(' ');
    expect(CATALOG.filter((entry) => entry.category === 'champion')).toHaveLength(65);
    expect(CATALOG.filter((entry) => entry.category === 'champion').map((entry) => entry.id).sort()).toEqual(expected.sort());
  });

  it('uses packaged image assets for every catalog entry', () => {
    expect(CATALOG.every((entry) => entry.icon.startsWith('/catalog/') && entry.icon.endsWith('.png'))).toBe(true);
  });
});
