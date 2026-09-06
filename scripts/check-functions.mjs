import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = await typescriptFiles('supabase/functions');
const result = spawnSync('deno', ['check', ...files], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exitCode = result.status ?? 1;

async function typescriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.name === 'node_modules') return [];
    return entry.isDirectory() ? typescriptFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  }));
  return nested.flat();
}
