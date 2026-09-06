# ── Aperture on Cloud Run ────────────────────────────────────────────────────
# Multi-stage so the runtime image carries no source, no dev dependencies and
# no build cache. Next's `standalone` output ships only the files the server
# actually imports, which takes the final image from ~1.2GB to ~200MB.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the CLIENT bundle at BUILD time, so
# they must be present here rather than only at runtime. They are public config
# by design — see apphosting.yaml for why that is not a leak.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Never run as root. A container that does not need write access to its own
# filesystem should not have an identity that grants it.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

# Cloud Run injects PORT. The standalone server reads it; the npm start script
# hardcodes 3200 for local use, which is why this does not call npm.
ENV PORT=8080 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
