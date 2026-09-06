import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function requireBuildEnv(env) {
  const names = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing required production build variables: ${missing.join(', ')}`);
  const url = new URL(env.VITE_SUPABASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('VITE_SUPABASE_URL must use http or https');
  return { VITE_SUPABASE_URL: url.toString().replace(/\/$/, ''), VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY };
}

export async function verifyBuiltConfig(dist, env) {
  const config = requireBuildEnv(env);
  const files = await javascriptFiles(dist);
  const contents = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const name of Object.keys(config)) {
    if (!contents.includes(config[name])) throw new Error(`Built artifact does not contain ${name}`);
  }
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : extname(entry.name) === '.js' ? [path] : [];
  }));
  return nested.flat();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyBuiltConfig(process.argv[2] ?? 'dist', process.env);
  console.log('Verified Supabase configuration in built artifact.');
}
