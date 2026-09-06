import type { CatalogEntry } from './types';

// Snapshot: TFT Set 15 K.O. Coliseum, with canonical Riot data IDs as of Aug 2025.
// IDs are stable and intentionally independent of display names. Component IDs are
// the ten canonical basic components in that set; no synthesized aliases are used.
export const CATALOG: readonly CatalogEntry[] = [
  { id: 'ahri', name: 'Ahri', category: 'champion', icon: 'ahri' },
  { id: 'garen', name: 'Garen', category: 'champion', icon: 'garen' },
  { id: 'jinx', name: 'Jinx', category: 'champion', icon: 'jinx' },
  { id: 'kindred', name: 'Kindred', category: 'champion', icon: 'kindred' },
  { id: 'kobuko', name: 'Kobuko', category: 'champion', icon: 'kobuko' },
  { id: 'lillia', name: 'Lillia', category: 'champion', icon: 'lillia' },
  { id: 'malphite', name: 'Malphite', category: 'champion', icon: 'malphite' },
  { id: 'shen', name: 'Shen', category: 'champion', icon: 'shen' },
  { id: 'viego', name: 'Viego', category: 'champion', icon: 'viego' },
  { id: 'xayah', name: 'Xayah', category: 'champion', icon: 'xayah' },
  { id: 'yuumi', name: 'Yuumi', category: 'champion', icon: 'yuumi' },
  { id: 'zac', name: 'Zac', category: 'champion', icon: 'zac' },
  { id: 'bf-sword', name: 'B.F. Sword', category: 'component', icon: 'bf-sword' },
  { id: 'recurve-bow', name: 'Recurve Bow', category: 'component', icon: 'recurve-bow' },
  { id: 'needlessly-large-rod', name: 'Needlessly Large Rod', category: 'component', icon: 'needlessly-large-rod' },
  { id: 'tear-of-the-goddess', name: 'Tear of the Goddess', category: 'component', icon: 'tear-of-the-goddess' },
  { id: 'chain-vest', name: 'Chain Vest', category: 'component', icon: 'chain-vest' },
  { id: 'negatron-cloak', name: 'Negatron Cloak', category: 'component', icon: 'negatron-cloak' },
  { id: 'giants-belt', name: "Giant's Belt", category: 'component', icon: 'giants-belt' },
  { id: 'sparring-gloves', name: 'Sparring Gloves', category: 'component', icon: 'sparring-gloves' },
  { id: 'spatula', name: 'Spatula', category: 'component', icon: 'spatula' },
  { id: 'frying-pan', name: 'Frying Pan', category: 'component', icon: 'frying-pan' },
];
