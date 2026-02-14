# syntax=docker/dockerfile:1.7
FROM 1password/op:2@sha256:57d7d6a2bb2b74b2cf8111f6afb2973c74772198f82ea30359a53faae9fff5b1 AS op

FROM node:22-slim AS builder

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare npm@11.8.0 --activate

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --include=dev

COPY . .
RUN npm run build

FROM node:22-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3012 \
    OP_CONFIG_DIR=/tmp/op

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init gosu \
  && rm -rf /var/lib/apt/lists/*

COPY --from=op /usr/local/bin/op /usr/local/bin/op

RUN groupadd --system --gid 1001 appuser \
  && useradd --system --uid 1001 --gid 1001 --create-home --home-dir /home/appuser appuser

COPY package.json package-lock.json ./
RUN corepack enable && corepack prepare npm@11.8.0 --activate \
  && npm ci --omit=dev --legacy-peer-deps \
  && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/.next/cache /tmp/op /home/appuser/.config /home/appuser/.npm \
  && chown -R appuser:appuser /app /tmp/op /home/appuser

EXPOSE 3012

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3012) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]
