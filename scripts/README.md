# CI/CD Setup Guide – EasyEdu Demo

Hướng dẫn thiết lập CI/CD từ A→Z cho môi trường demo
(GitHub Actions → ngrok → Ubuntu VM → Docker).

## Kiến trúc tổng quan

```
[Developer]
    │ git push main
    ▼
[GitHub] ──────────────────────────────────────────────
    │                                                  │
    ▼                                                  │
[GitHub Actions]                                       │
    │  Job 1 (CI): build backend + frontend            │
    │  Job 2 (CD): curl POST webhook URL               │
    │                                                  │
    ▼                                                  │
[ngrok tunnel] ──────────── expose ──────────────▶ │
    │                                                  │
    ▼                                                  │
[Ubuntu VM - port 9000]                               │
    │  webhook listener (adnanh/webhook)               │
    │  verify HMAC secret                              │
    │  run deploy.sh                                   │
    │                                                  │
    ▼                                                  │
[deploy.sh]                                           │
    │  git pull origin main                            │
    │  docker compose -f docker-compose.prod.yml       │
    │    build backend frontend                        │
    │  nginx -s reload                                 │
    │                                                  │
    ▼                                                  │
[Containers]                                          │
    ├── postgres:5432  (internal)                       │
    ├── backend:3001   (internal – NestJS + Prisma)     │
    ├── frontend:3000  (internal – Next.js standalone)  │
    └── nginx:80       (port duy nhất ra ngoài)         │
    │      /api → backend:3001                         │
    │      /    → frontend:3000                        │
    │                                                  │
    ▼                                                  │
[Browser] http://localhost ◄───────────────────────────────
```

---

## Bước 1 – Chuẩn bị Ubuntu VM

### 1.1 Chạy setup script
```bash
# Clone repo vào VM (hoặc copy setup-server.sh)
git clone https://github.com/hienhien1111/easyedudemo.git ~/easyedudemo
cd ~/easyedudemo

# Chạy setup (cài Docker, ngrok, webhook tool, systemd service)
chmod +x scripts/setup-server.sh
bash scripts/setup-server.sh
```

### 1.2 Cấu hình .env.production
```bash
nano ~/easyedudemo/.env.production
```

Điền các giá trị thật (thay `CHANGE_ME`):
```env
POSTGRES_PASSWORD=mat_khau_manh
JWT_ACCESS_SECRET=chuoi_random_64_ky_tu
JWT_REFRESH_SECRET=chuoi_random_khac_64_ky_tu
```

Tạo chuỗi random:
```bash
openssl rand -base64 48  # dùng kết quả này cho JWT secrets
```

---

## Bước 2 – Cấu hình webhook secret

### 2.1 Chọn webhook secret
```bash
# Tạo secret ngẫu nhiên
openssl rand -hex 32
# Ví dụ: a3f8c2d1e5b7...
```

### 2.2 Cập nhật webhook.json
```bash
nano ~/easyedudemo/scripts/webhook.json
```
Thay `YOUR_WEBHOOK_SECRET_HERE` bằng chuỗi vừa tạo.

### 2.3 Khởi động lại webhook service
```bash
sudo systemctl restart eedemo-webhook
sudo systemctl status eedemo-webhook  # kiểm tra đang chạy
```

---

## Bước 3 – Cấu hình ngrok

### 3.1 Đăng ký tài khoản ngrok miễn phí
Vào https://dashboard.ngrok.com → Copy authtoken

### 3.2 Đăng nhập ngrok trên VM
```bash
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```

### 3.3 Lấy Static Domain (khuyến nghị – không đổi URL mỗi lần restart)
Vào https://dashboard.ngrok.com/cloud-edge/domains → "New Domain"
→ Được 1 domain miễn phí, ví dụ: `abc-xyz.ngrok-free.app`

### 3.4 Khởi động ngrok tunnel
```bash
# Với static domain (khuyến nghị)
ngrok http --domain=abc-xyz.ngrok-free.app 9000

# Hoặc không static domain (URL thay đổi mỗi lần)
ngrok http 9000
```

Ghi lại URL ngrok, ví dụ: `https://abc-xyz.ngrok-free.app`

> Chú ý: ngrok cần chạy liên tục. Có thể dùng `tmux` hoặc tạo service:
> ```bash
> tmux new-session -d -s ngrok 'ngrok http --domain=abc-xyz.ngrok-free.app 9000'
> ```

---

## Bước 4 – Cấu hình GitHub Secrets

Vào GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Giá trị |
|-------------|---------|
| `DEPLOY_WEBHOOK_URL` | `https://abc-xyz.ngrok-free.app/hooks/deploy` |
| `DEPLOY_WEBHOOK_SECRET` | Chuỗi secret từ Bước 2.1 |

---

## Bước 5 – Test toàn bộ pipeline

### 5.1 Test webhook manually
```bash
# Từ máy local hoặc VM, kiểm tra webhook nhận được không
curl -X POST "https://abc-xyz.ngrok-free.app/hooks/deploy" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"ref":"refs/heads/main","sha":"test","message":"manual test"}'
```

### 5.2 Push code và quan sát
```bash
# Từ máy local
echo "test" >> README.md
git add . && git commit -m "test: trigger CI/CD pipeline"
git push origin main
```

Quan sát:
- **GitHub** → Actions tab → CI/CD Pipeline workflow chạy
- **VM** → `tail -f /var/log/eedemo-deploy.log`
- **Browser** → `http://localhost` (qua nginx port 80)

---

## Monitoring & Troubleshooting

### Kiểm tra containers
```bash
cd ~/easyedudemo
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend
docker compose -f docker-compose.prod.yml logs --tail=50 frontend
docker compose -f docker-compose.prod.yml logs --tail=50 nginx

# Nginx health check
curl http://localhost/nginx-health

# Test routing qua nginx
curl http://localhost/api        # → backend (NestJS)
curl http://localhost            # → frontend (Next.js)
```

### Kiểm tra webhook service
```bash
sudo systemctl status eedemo-webhook
sudo journalctl -u eedemo-webhook -f  # logs realtime
```

### Deploy logs
```bash
tail -f /var/log/eedemo-deploy.log
```

### Restart thủ công
```bash
cd ~/easyedudemo
bash scripts/deploy.sh
```

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|----------|
| Webhook trả về 403 | Secret không khớp | Kiểm tra `webhook.json` và GitHub secret |
| `docker: permission denied` | User chưa vào group docker | `sudo usermod -aG docker $USER` rồi logout/login |
| Frontend không load | `output: 'standalone'` chưa bật | Kiểm tra `next.config.js` |
| Prisma migrate fail | DB chưa sẵn sàng | Xem logs postgres, kiểm tra `POSTGRES_PASSWORD` |
| ngrok URL bị thay đổi | Dùng free tier không có static domain | Đăng ký static domain hoặc cập nhật GitHub secret |
| nginx 502 Bad Gateway | Backend/frontend container chưa sẵn sàng | Chờ containers khởi động xong, xem `docker compose logs` |
| nginx 404 cho `/api` | NestJS chưa set global prefix `/api` | Kiểm tra `main.ts` có `app.setGlobalPrefix('api')` |
| `curl http://localhost` không phản hồi | nginx container chưa chạy | `docker compose -f docker-compose.prod.yml up -d nginx` |
