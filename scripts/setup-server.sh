#!/bin/bash
# scripts/setup-server.sh
# Chạy MỘT LẦN trên Ubuntu VM để cài đặt môi trường CI/CD
# ─────────────────────────────────────────────────────────
# Cách dùng:
#   chmod +x setup-server.sh
#   bash setup-server.sh
# ─────────────────────────────────────────────────────────

set -e

REPO_URL="${REPO_URL:-https://github.com/hienhien1111/easyedudemo.git}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/easyedudemo}"
WEBHOOK_PORT=9000

echo "═══════════════════════════════════════════════"
echo "  EasyEdu Demo – Server Setup Script"
echo "═══════════════════════════════════════════════"

# ── 1. System update ──────────────────────────────
echo ""
echo "▶ [1/6] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git wget gnupg2 ca-certificates lsb-release

# ── 2. Install Docker ─────────────────────────────
echo ""
echo "▶ [2/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo bash
  sudo usermod -aG docker "$USER"
  echo "Docker installed. NOTE: Log out & back in for group changes to take effect."
else
  echo "Docker already installed: $(docker --version)"
fi

# Docker Compose plugin
if ! docker compose version &>/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-plugin
fi
echo "Docker Compose: $(docker compose version)"

# ── 3. Clone repo ─────────────────────────────────
echo ""
echo "▶ [3/6] Setting up project..."
if [ -d "$PROJECT_DIR" ]; then
  echo "   Directory exists, pulling latest..."
  cd "$PROJECT_DIR" && git pull origin main
else
  echo "   Cloning from $REPO_URL..."
  git clone "$REPO_URL" "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# Tạo .env.production từ example
if [ ! -f ".env.production" ]; then
  cp .env.production.example .env.production
  echo ".env.production created from example"
  echo "IMPORTANT: Edit .env.production and fill in real secrets!"
else
  echo ".env.production already exists"
fi

# Chmod deploy script
chmod +x scripts/deploy.sh
echo "deploy.sh is executable"

# ── 4. Install webhook tool ───────────────────────
echo ""
echo "▶ [4/6] Installing webhook tool..."
WEBHOOK_VERSION="2.8.1"
ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "amd64" ]; then WEBHOOK_ARCH="amd64"; else WEBHOOK_ARCH="arm64"; fi

if ! command -v webhook &>/dev/null; then
  wget -q "https://github.com/adnanh/webhook/releases/download/${WEBHOOK_VERSION}/webhook-linux-${WEBHOOK_ARCH}.tar.gz" -O /tmp/webhook.tar.gz
  sudo tar -xzf /tmp/webhook.tar.gz -C /usr/local/bin --strip-components=1
  rm /tmp/webhook.tar.gz
  echo "webhook installed: $(webhook --version)"
else
  echo "webhook already installed: $(webhook --version)"
fi

# ── 5. Install ngrok ──────────────────────────────
echo ""
echo "▶ [5/6] Installing ngrok..."
if ! command -v ngrok &>/dev/null; then
  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
    | sudo tee /etc/apt/sources.list.d/ngrok.list
  sudo apt-get update -y && sudo apt-get install -y ngrok
  echo "ngrok installed"
else
  echo "ngrok already installed: $(ngrok version)"
fi

# ── 6. Create systemd service for webhook ─────────
echo ""
echo "▶ [6/6] Setting up webhook as systemd service..."
WEBHOOK_CONFIG="$PROJECT_DIR/scripts/webhook.json"
WEBHOOK_SERVICE="/etc/systemd/system/eedemo-webhook.service"

sudo tee "$WEBHOOK_SERVICE" > /dev/null <<EOF
[Unit]
Description=EasyEdu Deploy Webhook Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/local/bin/webhook -hooks $WEBHOOK_CONFIG -port $WEBHOOK_PORT -verbose
Restart=always
RestartSec=5
Environment=PROJECT_DIR=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable eedemo-webhook
sudo systemctl restart eedemo-webhook
echo "Webhook service running on port $WEBHOOK_PORT"

# ── Done ──────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Next Steps:"
echo ""
echo "  1. Edit .env.production với secrets thật:"
echo "     nano $PROJECT_DIR/.env.production"
echo ""
echo "  2. Cập nhật webhook secret trong scripts/webhook.json:"
echo "     nano $PROJECT_DIR/scripts/webhook.json"
echo "     (thay YOUR_WEBHOOK_SECRET_HERE)"
echo ""
echo "  3. Đăng nhập ngrok (chỉ cần 1 lần):"
echo "     ngrok config add-authtoken YOUR_NGROK_TOKEN"
echo "     (lấy token tại: https://dashboard.ngrok.com)"
echo ""
echo "  4. Khởi động ngrok tunnel:"
echo "     ngrok http $WEBHOOK_PORT"
echo "     → Copy URL ngrok (vd: https://abc123.ngrok-free.app)"
echo ""
echo "  5. Thêm secrets vào GitHub repo:"
echo "     Settings → Secrets → Actions → New repository secret:"
echo "     - DEPLOY_WEBHOOK_URL = https://abc123.ngrok-free.app/hooks/deploy"
echo "     - DEPLOY_WEBHOOK_SECRET = (cùng giá trị với webhook.json)"
echo ""
echo "  6. Push code lên main và kiểm tra GitHub Actions!"
echo ""
echo "  Webhook status: sudo systemctl status eedemo-webhook"
echo "  Deploy logs:    tail -f /var/log/eedemo-deploy.log"
echo "═══════════════════════════════════════════════"
