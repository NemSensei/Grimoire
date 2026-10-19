# syntax=docker/dockerfile:1

# Image Debian (glibc) plutôt qu'Alpine : better-sqlite3 a de bien meilleures chances de
# trouver un binaire précompilé compatible, et sinon la compilation depuis les sources
# (via python3/make/g++, installés uniquement dans ce stage) est un chemin bien testé.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Image d'exécution : contient volontairement les sources et node_modules complets (pas de
# sortie "standalone" élaguée) pour que les scripts d'administration (scripts/create-user.ts,
# scripts/reindex.ts) restent exécutables via `docker compose exec` avec npx tsx.
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CONTENT_DIR=/app/content \
    DB_PATH=/app/data/grimoire.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# git : historique des fiches (content/ est un dépôt git géré par l'application).
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 grimoire \
    && useradd --uid 1001 --gid grimoire --shell /usr/sbin/nologin --create-home grimoire \
    && mkdir -p /app/content /app/data \
    && chown -R grimoire:grimoire /app

COPY --from=builder --chown=grimoire:grimoire /app/node_modules ./node_modules
COPY --from=builder --chown=grimoire:grimoire /app/.next ./.next
COPY --from=builder --chown=grimoire:grimoire /app/public ./public
COPY --from=builder --chown=grimoire:grimoire /app/package.json ./package.json
COPY --from=builder --chown=grimoire:grimoire /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=grimoire:grimoire /app/instrumentation.ts ./instrumentation.ts
COPY --from=builder --chown=grimoire:grimoire /app/proxy.ts ./proxy.ts
COPY --from=builder --chown=grimoire:grimoire /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=grimoire:grimoire /app/lib ./lib
COPY --from=builder --chown=grimoire:grimoire /app/scripts ./scripts

USER grimoire
EXPOSE 3000

CMD ["npm", "run", "start"]
