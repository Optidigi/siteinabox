# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=lts-alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
ARG SITE_URL=https://example.com
ENV SITE_URL=${SITE_URL}
RUN pnpm check:responsive && pnpm build

FROM node:${NODE_VERSION}
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV CMS_DATA_DIR=/data

# Copy production deps + built server bundle
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4321/healthz >/dev/null || exit 1

CMD ["node", "./dist/server/entry.mjs"]
