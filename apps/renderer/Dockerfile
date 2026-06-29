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

COPY apps/renderer apps/renderer
COPY packages/contracts packages/contracts
COPY packages/site-renderer packages/site-renderer
COPY packages/ui packages/ui
RUN pnpm install --frozen-lockfile --filter @siteinabox/renderer... --store-dir=/pnpm/store

ARG RENDERER_SITE_URL=https://renderer.siteinabox.nl
ARG AMICARE_SITE_URL=https://ami-care.nl
ENV SITE_URL=${RENDERER_SITE_URL}
ENV NODE_ENV=production
RUN test "${AMICARE_SITE_URL}" = "https://ami-care.nl" \
  && SITE_URL=${RENDERER_SITE_URL} pnpm --filter @siteinabox/renderer build \
  && pnpm --filter @siteinabox/renderer deploy --prod --legacy /app \
  && cp -R apps/renderer/dist /app/dist \
  && mkdir -p /app/legacy-tenants/amicare/client /app/legacy-tenants/amicare/media \
  && cp -R apps/renderer/src/lib/legacy-tenants/_assets/amicare/client/. /app/legacy-tenants/amicare/client/ \
  && cp -R apps/renderer/src/lib/legacy-tenants/_assets/amicare/media/. /app/legacy-tenants/amicare/media/

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
