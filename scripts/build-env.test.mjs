import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { requireBuildEnv, verifyBuiltConfig } from './build-env.mjs';

test('production build configuration rejects missing Supabase values', () => {
  assert.throws(
    () => requireBuildEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }),
    /VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/,
  );
});

test('artifact smoke check proves configured values were embedded', async () => {
  const root = await mkdtemp(join(tmpdir(), 'double-trouble-build-'));
  try {
    const assets = join(root, 'assets');
    await mkdir(assets);
    await writeFile(join(assets, 'app.js'), 'https://project.supabase.co public-anon-key');

    await assert.doesNotReject(() => verifyBuiltConfig(root, {
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    }));
    await assert.rejects(() => verifyBuiltConfig(root, {
      VITE_SUPABASE_URL: 'https://different.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    }), /does not contain VITE_SUPABASE_URL/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
