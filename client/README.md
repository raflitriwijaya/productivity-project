# Polymath OS — Client

React 19 + Vite/Rolldown frontend for [Polymath OS](../README.md).

For full project documentation see the root [README.md](../README.md).

## Development

```bash
# From this directory (client/)
npm install
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # Production build → dist/
npm test             # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests
npm run lint         # ESLint (0 warnings allowed)
```

Requires the API server running at `http://localhost:3000` (or set `VITE_API_URL`).
See [../server/](../server/) for backend setup.
