# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
# --omit=dev replaces deprecated --only=production (npm v7+)
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
