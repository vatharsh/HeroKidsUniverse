FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_API_URL must be baked in at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

RUN npm ci --ignore-scripts

COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# next build --output standalone copies only needed node_modules
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
