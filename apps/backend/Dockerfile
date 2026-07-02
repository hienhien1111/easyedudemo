# ─── Base ────────────────────────────────────────────────────────────────────
# Dùng node:22-alpine để khớp với CI workflow (Node 22 LTS)
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development
# Monorepo: chỉ có package.json ở workspace con, package-lock.json ở root.
# Dùng npm install (không dùng npm ci) vì không có lock file trong Docker context
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
# npm install sẽ tạo ra package-lock.json → dùng lại ở production stage
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
# Copy lock file do builder tạo ra → npm ci hoạt động được
COPY --from=builder /app/package-lock.json ./
# --omit=dev: chỉ cài production dependencies
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Prisma engine binaries cần thiết cho production
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
