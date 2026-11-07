# itsa10but API (Cloud Run). Build context = repo root. The Next.js site is on Vercel, not in this image.
# Stage 1 bundles server/server.ts and the lib/ modules it imports into one file.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY lib ./lib
COPY server ./server
RUN npm run build:server

# Stage 2 runs only the bundle (express, cors and @upstash/redis are inlined).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/dist ./server/dist
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||8080)+'/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "server/dist/server.cjs"]
