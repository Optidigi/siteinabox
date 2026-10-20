# syntax=docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat \
  && npm install -g pnpm@12.14.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN node -e 'if (!process.release.lts) throw new Error("An actual Node LTS build runtime is required")' \
  && test "$(pnpm --version)" = "$(node -p 'require("./package.json").packageManager.split("@")[1]')"
COPY apps/renderer/package.json apps/renderer/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/legal-content/package.json packages/legal-content/package.json
COPY packages/site-renderer/package.json packages/site-renderer/package.json
COPY packages/ui/package.json packages/ui/package.json

COPY apps/renderer apps/renderer
COPY packages/contracts packages/contracts
COPY packages/legal-content packages/legal-content
COPY packages/site-renderer packages/site-renderer
COPY packages/ui packages/ui
RUN pnpm install --frozen-lockfile --filter @siteinabox/renderer... --store-dir=/pnpm/store

ENV NODE_ENV=production
RUN pnpm --filter @siteinabox/renderer build \
  && pnpm --filter @siteinabox/renderer deploy --prod --legacy /app \
  && cp -R apps/renderer/dist /app/dist

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runner
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
