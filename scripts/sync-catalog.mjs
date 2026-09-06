import { readFile, writeFile } from 'node:fs/promises';

const domainSource = await readFile('packages/domain/src/catalog.ts', 'utf8');
const championIds = extractIds(domainSource, /champion\('([^']+)'/g);
const componentIds = extractIds(domainSource, /component\('([^']+)'/g);

const output = `// Generated from packages/domain/src/catalog.ts. Do not edit by hand.
export const CHAMPION_IDS = [
  ${championIds.map((id) => `'${id}'`).join(', ')}
] as const;

export const COMPONENT_IDS = [
  ${componentIds.map((id) => `'${id}'`).join(', ')}
] as const;
`;

await writeFile('supabase/functions/_shared/catalog-ids.ts', output);

function extractIds(source, pattern) {
  const ids = [];
  for (const match of source.matchAll(pattern)) ids.push(match[1]);
  if (!ids.length) throw new Error(`No ids matched ${pattern}`);
  return ids;
}
