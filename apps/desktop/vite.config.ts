import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { requireBuildEnv } from '../../scripts/build-env.mjs';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') requireBuildEnv(loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss()],
    test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' },
  };
});
