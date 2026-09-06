export function requireBuildEnv(env: Record<string, string | undefined>): {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string | undefined;
};

export function verifyBuiltConfig(dist: string, env: Record<string, string | undefined>): Promise<void>;
