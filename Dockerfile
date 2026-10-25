FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 DEPLOY_TARGET=railway
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
RUN npm run build:railway

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DEPLOY_TARGET=railway HOSTNAME=0.0.0.0 PORT=8080
COPY --from=builder /app/.next-railway/standalone ./
COPY --from=builder /app/.next-railway/static ./.next-railway/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/railway-start.mjs ./scripts/railway-start.mjs
EXPOSE 8080
CMD ["node", "scripts/railway-start.mjs"]
