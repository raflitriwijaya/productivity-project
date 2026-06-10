FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Phase 12: run as non-root to reduce container attack surface.
# node:22-alpine ships the built-in 'node' user (uid 1000).
RUN chown -R node:node /app
USER node
EXPOSE 3000
# Phase 2: run migrations automatically on every deploy before the server starts
CMD ["sh", "-c", "node db/migrate.js && node index.js"]
