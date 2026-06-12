import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Dev server runs on 5173 (§6.0). The /api proxy lets the client call the API
// with a relative baseURL (avoiding CORS in dev); it is harmless when
// VITE_API_URL points directly at the API instead (hardening 3C).
export default defineConfig({
  plugins: [
    react(),
    // Wave 6 (Moonshots): installable PWA + offline support. `autoUpdate` swaps in
    // a new service worker as soon as it's ready; `injectRegister: 'auto'` injects
    // the registration into index.html so no manual code is needed in main.jsx.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'offline.html', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: "Rafli's Productivity Suite — Polymath OS",
        short_name: 'Polymath OS',
        description: 'Personal productivity system for researcher, engineer, startup founder, and polymath.',
        theme_color: '#4A7C59',
        background_color: '#2b2723',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA navigations fall back to the cached index.html; when even that misses
        // (cold offline on an uncached route), serve the static offline page.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/metrics/, /^\/health/],
        runtimeCaching: [
          {
            // API GETs: try the network first, fall back to cache when offline so
            // the dashboard still renders the last-known data (stale, by design).
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
