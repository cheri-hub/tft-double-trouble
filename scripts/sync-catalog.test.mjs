import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('edge catalog ids stay in lockstep with the domain catalog', async () => {
  const shared = await readFile('supabase/functions/_shared/catalog-ids.ts', 'utf8');
  const domain = await readFile('packages/domain/src/catalog.ts', 'utf8');
  const championIds = [...domain.matchAll(/champion\('([^']+)'/g)].map((match) => match[1]);
  const componentIds = [...domain.matchAll(/component\('([^']+)'/g)].map((match) => match[1]);

  assert.match(shared, new RegExp(`CHAMPION_IDS = \\[\\s*${championIds.map((id) => `'${id}'`).join(',\\s*')}`));
  assert.match(shared, new RegExp(`COMPONENT_IDS = \\[\\s*${componentIds.map((id) => `'${id}'`).join(',\\s*')}`));
});
