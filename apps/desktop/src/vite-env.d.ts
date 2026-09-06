/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

declare module '../../scripts/build-env.mjs' {
  export function requireBuildEnv(env: Record<string, string | undefined>): {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string | undefined;
  };
}
