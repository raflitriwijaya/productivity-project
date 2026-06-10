# Stage 1: Build React app
FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=https://raflitriwijaya.my.id
ENV VITE_API_URL=$VITE_API_URL
# Phase 9: accept the Sentry DSN at build time so Sentry.init actually compiles in.
# Empty by default → main.jsx's `if (VITE_SENTRY_DSN)` guard keeps it a no-op.
ARG VITE_SENTRY_DSN=
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve dengan Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
