# Hướng dẫn Triển khai – EasyEdu Demo

Tài liệu này mô tả **hai luồng triển khai** cho dự án:

| Luồng | Mô tả | Phù hợp |
|-------|-------|---------|
| **A – SVN Manual** | Commit SVN → `svn export` trên server → `docker compose up --build` | Demo bài tập, môi trường nội bộ |
| **B – GitHub Actions CI/CD** | Push GitHub → CI build check → webhook → tự động deploy | Tích hợp liên tục, automation |

---

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                      LUỒNG A – SVN                              │
│                                                                 │
│  (1) Lập trình viên                                             │
│         │  svn commit                                           │
│         ▼                                                       │
│  (2) SVN Server (kho trung tâm)                                 │
│         │  svn export (lấy mã nguồn sạch, không có .svn)       │
│         ▼                                                       │
│  (3) Server Ubuntu – build & chạy Docker                        │
│         ├── docker compose -f docker-compose.prod.yml up -d --build
│         ├── postgres container  (internal)                      │
│         ├── backend container   (internal – NestJS)             │
│         ├── frontend container  (internal – Next.js)            │
│         └── nginx container     (port 80 – entry point)         │
│                  /api → backend:3001                            │
│                  /    → frontend:3000                           │
│         │                                                       │
│         ▼                                                       │
│  (4) Trình duyệt kiểm thử → http://server-ip                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               LUỒNG B – GitHub Actions CI/CD                    │
│                                                                 │
│  (1) Lập trình viên                                             │
│         │  git push origin main                                 │
│         ▼                                                       │
│  (2) GitHub Actions                                             │
│         ├── CI: build backend (NestJS)                          │
│         ├── CI: build frontend (Next.js)                        │
│         └── CD: curl POST → ngrok URL                           │
│                      │                                          │
│                      ▼                                          │
│  (3) ngrok tunnel → Ubuntu VM port 9000                         │
│         │  webhook listener nhận request, verify secret        │
│         │  chạy deploy.sh                                       │
│         ▼                                                       │
│  (4) deploy.sh trên server                                      │
│         ├── git pull origin main                                │
│         ├── docker compose build backend frontend               │
│         ├── docker compose up -d backend frontend               │
│         └── nginx -s reload                                     │
│         │                                                       │
│         ▼                                                       │
│  (5) Containers                                                 │
│         ├── postgres  (internal)                                │
│         ├── backend   (internal – NestJS + Prisma migrate)      │
│         ├── frontend  (internal – Next.js standalone)           │
│         └── nginx:80  (entry point duy nhất)                   │
│                  /api → backend:3001                            │
│                  /    → frontend:3000                           │
│         │                                                       │
│         ▼                                                       │
│  (6) Trình duyệt kiểm thử → http://localhost                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Yêu cầu chung (cả hai luồng)

Trên **server Ubuntu**, cần cài sẵn:

```bash
# Docker Engine
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
# Đăng xuất và đăng nhập lại để áp dụng group

# Kiểm tra
docker --version          # Docker 24+
docker compose version    # Docker Compose v2+
```

> **Lưu ý**: Nginx chạy dưới dạng Docker container (`nginx:1.27-alpine`),
> **không cần** cài nginx trực tiếp lên hệ thống.

---

## LUỒNG A – Triển khai từ SVN

### Bước A1 – Cài đặt SVN Server (chỉ làm 1 lần)

```bash
# Cài VisualSVN Server (Windows) hoặc Apache SVN (Ubuntu)
sudo apt-get install -y subversion

# Tạo kho SVN
sudo svnadmin create /var/svn/repos/duan_phanmem

# Phân quyền
sudo chown -R www-data:www-data /var/svn/repos/duan_phanmem

# Tạo user svn01
sudo htpasswd -c /etc/subversion/passwd sv01
```

### Bước A2 – Cấu hình thư mục dự án trên server

```bash
# Tạo thư mục làm việc Docker
mkdir -p ~/web-docker
cd ~/web-docker

# Tạo file .env.production từ template
cp .env.production.example .env.production
nano .env.production   # Điền giá trị thật
```

Điền các giá trị bắt buộc trong `.env.production`:
```env
POSTGRES_PASSWORD=mat_khau_manh_it_nhat_16_ky_tu
JWT_ACCESS_SECRET=<chuỗi random 64 ký tự>
JWT_REFRESH_SECRET=<chuỗi random 64 ký tự khác>

# URL mà BROWSER truy cập API qua nginx
NEXT_PUBLIC_API_URL=http://<server-ip>/api
```

### Bước A3 – Lập trình viên commit code lên SVN

```bash
# Trên máy lập trình viên
# Checkout lần đầu (chỉ làm 1 lần)
svn checkout http://svn-server-ip/svn/duan_phanmem/trunk ./project --username sv01

# Thêm file mới vào SVN
cd ./project
svn add .

# Commit code
svn commit -m "Thêm tính năng quản lý lịch học" --username sv01
```

### Bước A4 – Deploy trên server (thủ công)

```bash
# Trên server Ubuntu
cd ~/web-docker

# Xóa mã nguồn cũ và lấy bản mới sạch từ SVN
rm -rf src
svn export http://svn-server-ip/svn/duan_phanmem/trunk src --username sv01

# Build lại và chạy containers (bao gồm nginx)
cd src
docker compose -f docker-compose.prod.yml up -d --build

# Kiểm tra containers đang chạy
docker compose -f docker-compose.prod.yml ps
```

Kết quả mong đợi:
```
NAME              STATUS
eedemo_postgres   Up (healthy)
eedemo_backend    Up
eedemo_frontend   Up
eedemo_nginx      Up (healthy)
```

### Bước A5 – Kiểm tra kết quả

```bash
# Xem logs realtime
docker compose -f docker-compose.prod.yml logs -f

# Kiểm tra nginx health
curl http://localhost/nginx-health      # → "ok"

# Kiểm tra routing qua nginx
curl http://localhost/api               # → NestJS API (qua nginx port 80)
curl http://localhost                   # → Next.js frontend

# Mở trình duyệt
# → http://localhost  (hoặc http://server-ip nếu truy cập từ xa)
```

---

## LUỒNG B – GitHub Actions CI/CD (Tự động)

### Bước B1 – Cài đặt môi trường server (chỉ làm 1 lần)

Chạy script setup tự động:

```bash
# Clone repo vào server
git clone https://github.com/hienhien1111/easyedudemo.git ~/easyedudemo
cd ~/easyedudemo

# Chạy script cài đặt (Docker, ngrok, webhook tool, systemd service)
chmod +x scripts/setup-server.sh
bash scripts/setup-server.sh
```

Script sẽ tự động cài:
- ✅ Docker + Docker Compose
- ✅ `webhook` tool (lightweight HTTP listener)
- ✅ `ngrok` (tunnel từ internet vào VM)
- ✅ Systemd service cho webhook listener

> Nginx **không cần cài riêng** – chạy như Docker container.

### Bước B2 – Cấu hình biến môi trường production

```bash
cd ~/easyedudemo

# Tạo .env.production từ template
cp .env.production.example .env.production
nano .env.production
```

Điền các giá trị bắt buộc:
```env
POSTGRES_PASSWORD=mat_khau_manh_it_nhat_16_ky_tu
JWT_ACCESS_SECRET=<chuỗi random 64 ký tự>
JWT_REFRESH_SECRET=<chuỗi random 64 ký tự khác>

# API đi qua nginx port 80
NEXT_PUBLIC_API_URL=http://localhost/api
```

Tạo chuỗi random:
```bash
openssl rand -base64 48
```

### Bước B3 – Cấu hình webhook secret

```bash
# Tạo secret ngẫu nhiên
SECRET=$(openssl rand -hex 32)
echo "Webhook secret: $SECRET"   # Lưu lại giá trị này

# Cập nhật vào webhook.json
nano ~/easyedudemo/scripts/webhook.json
# Thay YOUR_WEBHOOK_SECRET_HERE → giá trị vừa tạo

# Khởi động lại webhook service
sudo systemctl restart eedemo-webhook
sudo systemctl status eedemo-webhook   # Kiểm tra đang chạy
```

### Bước B4 – Thiết lập ngrok tunnel

```bash
# 1. Đăng ký tài khoản miễn phí tại https://dashboard.ngrok.com
# 2. Copy authtoken từ dashboard

# Đăng nhập ngrok
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN

# (Khuyến nghị) Tạo Static Domain miễn phí
# → https://dashboard.ngrok.com/cloud-edge/domains → "New Domain"
# → Được domain cố định: abc-xyz.ngrok-free.app

# Khởi động tunnel (chạy trong background với tmux)
tmux new-session -d -s ngrok \
  'ngrok http --domain=abc-xyz.ngrok-free.app 9000'

# Kiểm tra tunnel đang hoạt động
curl https://abc-xyz.ngrok-free.app/hooks/deploy
# Kỳ vọng: {"error":"Method Not Allowed"} (webhook listener đang hoạt động)
```

### Bước B5 – Cấu hình GitHub Secrets

Vào GitHub repo → **Settings** → **Secrets and variables** → **Actions**

| Secret Name | Giá trị |
|-------------|---------|
| `DEPLOY_WEBHOOK_URL` | `https://abc-xyz.ngrok-free.app/hooks/deploy` |
| `DEPLOY_WEBHOOK_SECRET` | Chuỗi secret từ Bước B3 |

### Bước B6 – Test toàn bộ pipeline

**Test webhook thủ công trước:**
```bash
curl -X POST "https://abc-xyz.ngrok-free.app/hooks/deploy" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"ref":"refs/heads/main","sha":"test"}'
# Kỳ vọng: HTTP 200 và deploy.sh bắt đầu chạy
```

**Test toàn bộ pipeline:**
```bash
# Trên máy lập trình viên
echo "# test deploy $(date)" >> README.md
git add . && git commit -m "test: kiểm tra CI/CD pipeline"
git push origin main
```

Quan sát:
- **GitHub** → tab Actions → workflow "CI/CD Pipeline" đang chạy
- **Server** → `tail -f /var/log/eedemo-deploy.log`
- **Browser** → `http://localhost` (qua nginx port 80)

---

## So sánh hai luồng

| Tiêu chí | Luồng A – SVN | Luồng B – GitHub Actions |
|---------|--------------|--------------------------|
| **Kích hoạt** | Thủ công (chạy lệnh trên server) | Tự động khi push lên `main` |
| **Kiểm tra code** | Không | Có – build check TypeScript + Next.js |
| **Version control** | SVN | Git / GitHub |
| **Phù hợp** | Demo bài tập, học SVN | CI/CD thực tế, automation |
| **Yêu cầu thêm** | SVN Server | ngrok, GitHub Secrets |
| **Thời gian deploy** | Nhanh (thủ công) | 3–5 phút (tự động) |

---

## Cấu trúc Docker (dùng chung cả hai luồng)

```
docker-compose.prod.yml
├── postgres              # PostgreSQL 16 (internal, port 5432)
│     └── Healthcheck: pg_isready
├── backend               # NestJS API (internal, port 3001)
│     └── CMD: prisma migrate deploy && node dist/main
├── frontend              # Next.js standalone (internal, port 3000)
│     └── CMD: node server.js
└── nginx                 # Reverse Proxy (expose port 80 → host)
      ├── /api/*  → backend:3001
      └── /*      → frontend:3000
```

**Thứ tự khởi động**: `postgres` (healthy) → `backend` → `frontend` → `nginx`

**Lưu ý quan trọng**:
- Backend và frontend **KHÔNG expose port ra ngoài host** trong production
- **Chỉ nginx** expose port 80 – là entry point duy nhất
- `NEXT_PUBLIC_API_URL` phải trỏ về nginx: `http://<server-ip>/api`

---

## Monitoring & Troubleshooting

### Kiểm tra containers

```bash
cd ~/easyedudemo
docker compose -f docker-compose.prod.yml ps

# Logs từng service
docker compose -f docker-compose.prod.yml logs --tail=50 nginx
docker compose -f docker-compose.prod.yml logs --tail=50 backend
docker compose -f docker-compose.prod.yml logs --tail=50 frontend
docker compose -f docker-compose.prod.yml logs --tail=50 postgres
```

### Kiểm tra nginx

```bash
# Health endpoint
curl http://localhost/nginx-health          # → "ok"

# Test routing
curl http://localhost/api                   # → NestJS backend
curl http://localhost                       # → Next.js frontend

# Reload nginx config (không downtime)
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Logs nginx realtime
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Logs deploy (Luồng B)

```bash
tail -f /var/log/eedemo-deploy.log
sudo journalctl -u eedemo-webhook -f
```

### Restart thủ công

```bash
# Luồng A & B đều có thể dùng
cd ~/easyedudemo
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `svn: E170013: Unable to connect` | SVN server không chạy | Kiểm tra `systemctl status apache2` |
| `permission denied` (docker) | User chưa trong group docker | `sudo usermod -aG docker $USER` rồi logout/login |
| Frontend trắng trang | `output: standalone` chưa bật | Kiểm tra `next.config.js` |
| Prisma migrate fail | DB chưa ready | Xem log postgres, kiểm tra `POSTGRES_PASSWORD` |
| Webhook 403 | Secret không khớp | Kiểm tra `webhook.json` và GitHub Secret |
| ngrok URL đổi | Free tier không static domain | Tạo static domain miễn phí tại ngrok dashboard |
| `This job was skipped` | Deploy job chỉ chạy khi push vào `main` | Merge PR vào main trước |
| **nginx 502 Bad Gateway** | Backend/frontend chưa sẵn sàng | Chờ containers khởi động, xem `docker compose logs backend` |
| **nginx 404 cho `/api`** | NestJS chưa set global prefix | Kiểm tra `main.ts` có `app.setGlobalPrefix('api')` |
| **`curl http://localhost` không phản hồi** | nginx container chưa chạy | `docker compose -f docker-compose.prod.yml up -d nginx` |
| **API trả về CORS error** | `NEXT_PUBLIC_API_URL` sai | Đảm bảo dùng `http://server-ip/api`, không dùng `:3001` |
