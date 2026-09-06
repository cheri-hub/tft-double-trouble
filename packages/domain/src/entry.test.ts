import { describe, expect, it } from 'vitest';
import * as domain from './index';

describe('domain package entry point', () => {
  it('exports the public domain API', () => {
    expect(domain.CATALOG.length).toBeGreaterThan(0);
    expect(domain.validatePriorityLists).toBeTypeOf('function');
  });
});
