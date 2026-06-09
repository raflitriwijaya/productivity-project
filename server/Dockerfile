FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
# Phase 2: run migrations automatically on every deploy before the server starts
CMD ["sh", "-c", "node db/migrate.js && node index.js"]
