import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiPort = Number(env.VITE_API_PORT) || 3205;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT) || 5205,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  };
});
