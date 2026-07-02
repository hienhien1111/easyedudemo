# ─── Base ────────────────────────────────────────────────────────────────────
# Dùng node:22-alpine để khớp với CI workflow (Node 22 LTS)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development
# Monorepo: dùng npm install (không dùng npm ci) vì không có lock file trong Docker context
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
# NEXT_PUBLIC_* vars được baked vào JS bundle lúc build time, không phải runtime.
# Phải truyền vào đây qua ARG / build args trong docker-compose.
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
# npm install sẽ tạo ra package-lock.json (không có lock file trong workspace context)
RUN npm install
COPY . .
RUN npm run build

# ─── Production ──────────────────────────────────────────────────────────────
# Next.js standalone output đã bao gồm tất cả dependencies cần thiết.
# Không cần npm install thêm trong production stage.
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy standalone output từ builder
COPY --from=builder /app/.next/standalone ./
# Copy static files (CSS, JS, images)
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets (favicon, images, v.v.)
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
# HOSTNAME=0.0.0.0 bắt buộc để Next.js bind tất cả network interfaces trong Docker
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
