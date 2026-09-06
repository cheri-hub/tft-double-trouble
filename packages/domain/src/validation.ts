import type { CatalogEntry, PriorityLists, ValidationResult } from './types';

export function validatePriorityList(ids: string[], catalog: readonly CatalogEntry[], expectedCategory?: CatalogEntry['category']): ValidationResult {
  if (ids.length > 10) return { ok: false, code: 'too_many' };

  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (seen.has(id)) return { ok: false, code: 'duplicate', index };
    seen.add(id);
    const entry = byId.get(id);
    if (!entry) return { ok: false, code: 'unknown', index };
    if (expectedCategory && entry.category !== expectedCategory) return { ok: false, code: 'wrong_category', index };
  }
  return { ok: true, value: ids };
}

export function validatePriorityLists(lists: PriorityLists, catalog: readonly CatalogEntry[]): ValidationResult<PriorityLists> {
  const champions = validatePriorityList(lists.champions, catalog, 'champion');
  if (!champions.ok) return champions;
  const components = validatePriorityList(lists.components, catalog, 'component');
  if (!components.ok) return components;
  return { ok: true, value: { champions: champions.value, components: components.value } };
}
