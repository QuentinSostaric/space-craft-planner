import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Pas de proxy — le client contacte directement MongoDB Atlas Data API (HTTPS)
  },
});
