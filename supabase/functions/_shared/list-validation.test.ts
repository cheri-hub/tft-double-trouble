import { validatePriorityLists } from './list-validation.ts';

Deno.test('edge validation accepts current catalog ids in priority order', () => {
  const lists = { champions: ['ahri', 'elder-dragon'], components: ['bf-sword'] };
  const result = validatePriorityLists(lists);
  if (!result.ok || JSON.stringify(result.value) !== JSON.stringify(lists)) {
    throw new Error(`expected accepted lists, received ${JSON.stringify(result)}`);
  }
});

Deno.test('edge validation rejects unknown and duplicate ids', () => {
  const unknown = validatePriorityLists({ champions: ['not-current'], components: [] });
  if (unknown.ok || unknown.code !== 'unknown') throw new Error('unknown id was accepted');
  const duplicate = validatePriorityLists({ champions: ['ahri', 'ahri'], components: [] });
  if (duplicate.ok || duplicate.code !== 'duplicate') throw new Error('duplicate id was accepted');
});
