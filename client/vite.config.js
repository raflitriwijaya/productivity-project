import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev server runs on 5173 (§6.0). The /api proxy lets the client call the API
// with a relative baseURL (avoiding CORS in dev); it is harmless when
// VITE_API_URL points directly at the API instead (hardening 3C).
export default defineConfig({
  plugins: [react()],
  // Phase 11: vendor-split the heavy editor/highlighter so they are cached
  // independently and never inflate the main app chunk.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@uiw/react-md-editor') || id.includes('@uiw/react-markdown-preview') || id.includes('@uiw/codemirror') || id.includes('@codemirror')) {
            return 'mdeditor';
          }
          if (id.includes('prism-react-renderer')) {
            return 'prism';
          }
        },
      },
    },
  },
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
