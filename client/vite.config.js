import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev server runs on 5173 (§6.0). The /api proxy lets the client call the API
// with a relative baseURL (avoiding CORS in dev); it is harmless when
// VITE_API_URL points directly at the API instead (hardening 3C).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
