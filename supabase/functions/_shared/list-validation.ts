import { CHAMPION_IDS, COMPONENT_IDS } from './catalog-ids.ts';

export type PriorityLists = { champions: string[]; components: string[] };
export type ValidationResult =
  | { ok: true; value: PriorityLists }
  | { ok: false; code: 'too_many' | 'duplicate' | 'unknown' | 'wrong_category'; index?: number };

const champions = new Set<string>(CHAMPION_IDS);
const components = new Set<string>(COMPONENT_IDS);

export function validatePriorityLists(lists: PriorityLists): ValidationResult {
  const championResult = validate(lists.champions, champions, components);
  if (!championResult.ok) return championResult;
  const componentResult = validate(lists.components, components, champions);
  if (!componentResult.ok) return componentResult;
  return { ok: true, value: { champions: [...lists.champions], components: [...lists.components] } };
}

function validate(ids: string[], expected: ReadonlySet<string>, other: ReadonlySet<string>) {
  if (ids.length > 10) return { ok: false as const, code: 'too_many' as const };
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (seen.has(id)) return { ok: false as const, code: 'duplicate' as const, index };
    seen.add(id);
    if (other.has(id)) return { ok: false as const, code: 'wrong_category' as const, index };
    if (!expected.has(id)) return { ok: false as const, code: 'unknown' as const, index };
  }
  return { ok: true as const };
}
