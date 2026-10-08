# syntax=docker/dockerfile:1
# The whole platform in one image: Next.js server, API routes, Prisma + SQLite.
# Configuration comes from the environment at run time; nothing about a deployment is baked in.

FROM node:22-bookworm-slim AS base
# Prisma's engines need OpenSSL; outgoing HTTPS (PokéAPI, the x402 facilitator, Solana) needs CA certificates.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /app /data && chown node:node /app /data
WORKDIR /app
USER node

# ---- build: every dependency, then `next build`
FROM base AS build
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma/schema.prisma prisma/schema.prisma
RUN npm ci
COPY --chown=node:node . .
RUN DATABASE_URL=file:/tmp/build.db npm run build && rm -rf .next/cache

# ---- run: production dependencies (these include prisma and tsx, which the entrypoint uses)
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/rialto.db \
    INTERNAL_BASE_URL=http://127.0.0.1:3000
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node public ./public
COPY --chown=node:node lib ./lib
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node next.config.ts tsconfig.json ./

VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
