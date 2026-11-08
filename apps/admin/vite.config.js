import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_PROXY_TARGET || 'http://localhost:4000';
const proxy = {
  '/v1': { target: api, ws: true, changeOrigin: true },
  '/mockpay': { target: api, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy },
  preview: { host: true, proxy },
});
