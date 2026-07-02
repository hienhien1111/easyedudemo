#!/bin/bash
# scripts/deploy.sh
# Chạy trên Ubuntu VM khi nhận webhook từ GitHub Actions
# ─────────────────────────────────────────────────────────

set -e  # Dừng ngay nếu có lỗi

# ── Cấu hình ──────────────────────────────────────────────
PROJECT_DIR="${PROJECT_DIR:-/home/$(whoami)/easyedudemo}"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="/var/log/eedemo-deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Helper ────────────────────────────────────────────────
log() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# ── Bắt đầu deploy ────────────────────────────────────────
log "═══════════════════════════════════════"
log "Starting deployment..."

# 1. Vào thư mục project
log "Changing to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# 2. Pull code mới nhất
log "Pulling latest code from git..."
git pull origin main
log "Code updated to: $(git rev-parse --short HEAD)"

# 3. Build lại Docker images (production stage)
log "Building Docker images (production)..."
docker compose -f "$COMPOSE_FILE" build --no-cache backend frontend
log "Docker images built"

# 4. Khởi động lại containers (không downtime cho postgres)
log "Restarting containers..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps backend frontend
log "Containers restarted"

# 5. Chờ backend healthy (prisma migrate deploy)
log "Waiting for backend to be healthy (Prisma migrations)..."
RETRIES=0
MAX_RETRIES=30
until docker compose -f "$COMPOSE_FILE" exec -T backend \
    node -e "process.exit(0)" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    log "Backend failed to start after ${MAX_RETRIES} attempts"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
  fi
  log "   Attempt $RETRIES/$MAX_RETRIES – waiting 5s..."
  sleep 5
done
log "Backend is healthy"

# 6. Dọn dẹp Docker images cũ để tiết kiệm disk
log "Pruning unused Docker images..."
docker image prune -f
log "Cleanup done"

# 7. Tóm tắt
log "═══════════════════════════════════════"
log "Deployment completed successfully!"
log "Commit: $(git rev-parse --short HEAD)"
log "Time:   $TIMESTAMP"
log "Containers running:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" | tee -a "$LOG_FILE"
log "═══════════════════════════════════════"
