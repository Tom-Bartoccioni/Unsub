# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/api/node_modules ./api/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY api ./api
WORKDIR /repo/api
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/api/package.json ./api/
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/src/db/migrations ./api/src/db/migrations
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/shared/src ./packages/shared/src
RUN pnpm install --frozen-lockfile --prod
WORKDIR /app/api
EXPOSE 3000
# migrate -> seed the catalog (idempotent upsert, preserves cancel* columns) ->
# start. seed-catalog.js reads dist/db/catalog-seed.json, which `pnpm build`
# copies into dist via scripts/copy-assets.mjs.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed-catalog.js && node dist/index.js"]
