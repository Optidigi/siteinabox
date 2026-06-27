# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat \
  && npm install -g pnpm@11.5.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/renderer/package.json apps/renderer/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/site-renderer/package.json packages/site-renderer/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY sites/amblast/package.json sites/amblast/pnpm-lock.yaml sites/amblast/
COPY sites/ami-care/package.json sites/ami-care/pnpm-lock.yaml sites/ami-care/
RUN pnpm fetch --frozen-lockfile --store-dir=/pnpm/store
RUN pnpm --dir sites/amblast --ignore-workspace fetch --frozen-lockfile --store-dir=/pnpm/store
RUN pnpm --dir sites/ami-care --ignore-workspace fetch --frozen-lockfile --store-dir=/pnpm/store

COPY apps/renderer apps/renderer
COPY packages/contracts packages/contracts
COPY packages/site-renderer packages/site-renderer
COPY packages/ui packages/ui
COPY sites/amblast sites/amblast
COPY sites/ami-care sites/ami-care
RUN pnpm install --frozen-lockfile --offline --filter @siteinabox/renderer... --store-dir=/pnpm/store
RUN pnpm --dir sites/amblast --ignore-workspace install --frozen-lockfile --offline --store-dir=/pnpm/store
RUN pnpm --dir sites/ami-care --ignore-workspace install --frozen-lockfile --offline --store-dir=/pnpm/store

ARG RENDERER_SITE_URL=https://renderer.siteinabox.nl
ARG AMBLAST_SITE_URL=https://amblast.nl
ARG AMICARE_SITE_URL=https://ami-care.nl
ENV SITE_URL=${RENDERER_SITE_URL}
ENV NODE_ENV=production
RUN SITE_URL=${AMBLAST_SITE_URL} pnpm --dir sites/amblast --ignore-workspace build \
  && SITE_URL=${AMICARE_SITE_URL} pnpm --dir sites/ami-care --ignore-workspace build \
  && SITE_URL=${RENDERER_SITE_URL} pnpm --filter @siteinabox/renderer build \
  && pnpm --filter @siteinabox/renderer deploy --prod --legacy /app \
  && cp -R apps/renderer/dist /app/dist \
  && mkdir -p /app/legacy-tenants/amblast \
  && cp -R sites/amblast/dist/. /app/legacy-tenants/amblast/ \
  && mkdir -p /app/legacy-tenants/amicare/client /app/legacy-tenants/amicare/media \
  && cp -R sites/ami-care/dist/client/. /app/legacy-tenants/amicare/client/ \
  && cp sites/ami-care/src/assets/bedroom.jpg /app/legacy-tenants/amicare/media/bedroom.jpg \
  && cp sites/ami-care/src/assets/toys.jpg /app/legacy-tenants/amicare/media/toys.jpg

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
RUN apk add --no-cache wget
COPY --from=builder --chown=node:node /app ./
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --start-period=20s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/healthz || exit 1
CMD ["node", "./dist/server/entry.mjs"]
