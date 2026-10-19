FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Install all workspace deps (hoisted to root node_modules)
RUN npm ci --ignore-scripts

# Copy source and build
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# FFmpeg for story videos and narration MP3s. The npm ffmpeg-static binary is fetched by an install script,
# which `npm ci --ignore-scripts` skips — so the image previously had no FFmpeg at all.
RUN apk add --no-cache ffmpeg

# Only copy what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

EXPOSE 3001
CMD ["node", "dist/main"]
