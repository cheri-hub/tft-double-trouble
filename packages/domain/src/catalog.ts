import type { CatalogEntry } from './types';

export const CATALOG_SNAPSHOT = {
  set: 'TFT Set 18 — Enchanted Wilds', patch: '16.17', fetchedAt: '2026-09-06',
  source: 'https://raw.communitydragon.org/16.17/cdragon/tft/en_us.json',
  filter: "setData mutator TFTSet18; cost 1-5 with traits; collapse Lux variants to DA_Lux18_Base",
} as const;

const champion = (id: string, name: string): CatalogEntry => ({
  id, name, category: 'champion', icon: `/catalog/champions/${id}.png`,
});
const component = (id: string, name: string): CatalogEntry => ({
  id, name, category: 'component', icon: `/catalog/components/${id}.png`,
});

export const CATALOG: readonly CatalogEntry[] = [
  champion('gromp', 'Gromp'), champion('murkwolf', 'Murkwolf'), champion('pebbles', 'Pebbles'),
  champion('cinderling', 'Cinderling'), champion('scuttlecrab', 'Scuttlecrab'), champion('krug', 'Krug'),
  champion('sentinel', 'Sentinel'), champion('brambleback', 'Brambleback'), champion('xayah', 'Xayah'),
  champion('ornn', 'Ornn'), champion('nidalee', 'Nidalee'), champion('hecarim', 'Hecarim'),
  champion('ezreal', 'Ezreal'), champion('azir', 'Azir'), champion('rek-sai', "Rek'Sai"),
  champion('veigar', 'Veigar'), champion('maokai', 'Maokai'), champion('malphite', 'Malphite'),
  champion('yorick', 'Yorick'), champion('yunara', 'Yunara'), champion('sett', 'Sett'),
  champion('ahri', 'Ahri'), champion('ashe', 'Ashe'), champion('elise', 'Elise'),
  champion('caitlyn', 'Caitlyn'), champion('cassiopeia', 'Cassiopeia'), champion('morgana', 'Morgana'),
  champion('rakan', 'Rakan'), champion('lillia', 'Lillia'), champion('kobuko', 'Kobuko'),
  champion('teemo', 'Teemo'), champion('rammus', 'Rammus'), champion('gnar', 'Gnar'),
  champion('tristana', 'Tristana'), champion('sivir', 'Sivir'), champion('vi', 'Vi'),
  champion('akali', 'Akali'), champion('varus', 'Varus'), champion('amumu', 'Amumu'),
  champion('kennen', 'Kennen'), champion('aphelios', 'Aphelios'), champion('diana', 'Diana'),
  champion('alune', 'Alune'), champion('leona', 'Leona'), champion('kayle', 'Kayle'),
  champion('sejuani', 'Sejuani'), champion('kha-zix', "Kha'Zix"), champion('rengar', 'Rengar'),
  champion('kog-maw', "Kog'Maw"), champion('zyra', 'Zyra'), champion('fiddlesticks', 'Fiddlesticks'),
  champion('soraka', 'Soraka'), champion('taric', 'Taric'), champion('ivern', 'Ivern'),
  champion('lux', 'Lux'), champion('alistar', 'Alistar'), champion('draven', 'Draven'),
  champion('elder-dragon', 'Elder Dragon'), champion('karma', 'Karma'), champion('leblanc', 'LeBlanc'),
  champion('master-yi', 'Master Yi'), champion('shen', 'Shen'), champion('warwick', 'Warwick'),
  champion('camille', 'Camille'), champion('mama-beak', 'Mama Beak'),
  component('bf-sword', 'B.F. Sword'), component('recurve-bow', 'Recurve Bow'),
  component('needlessly-large-rod', 'Needlessly Large Rod'),
  component('tear-of-the-goddess', 'Tear of the Goddess'), component('chain-vest', 'Chain Vest'),
  component('negatron-cloak', 'Negatron Cloak'), component('giants-belt', "Giant's Belt"),
  component('sparring-gloves', 'Sparring Gloves'), component('spatula', 'Spatula'),
  component('frying-pan', 'Frying Pan'),
];
