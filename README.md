# EE Demo — Learning Center Management System

A monorepo demo project for managing a learning center, built with NestJS, Next.js, Prisma, and PostgreSQL.

## Project Structure

```
eedemo/
├── apps/
│   ├── backend/          # NestJS REST API (port 3001)
│   └── frontend/         # Next.js App Router (port 3000)
├── docker/
│   └── postgres/
│       └── init.sql
├── docker-compose.yml
├── .env.example
└── package.json
```

## Tech Stack

| Layer     | Technology                                  |
|-----------|---------------------------------------------|
| Backend   | NestJS, Prisma ORM, Passport.js, JWT        |
| Frontend  | Next.js 14 (App Router), Vanilla CSS        |
| Database  | PostgreSQL 16                               |
| Auth      | JWT (access 15m + refresh 7d), RBAC         |
| Infra     | Docker, Docker Compose                      |

## User Roles

| Role    | Description                        |
|---------|------------------------------------|
| ADMIN   | Full system access, manage users   |
| TEACHER | View/manage own classes            |
| STUDENT | View enrolled classes              |

## Quick Start

### Prerequisites
- Node.js >= 20
- Docker & Docker Compose
- npm >= 10

### 1. Setup environment
```bash
cp .env.example .env
# Edit .env with your values if needed
```

### 2. Start with Docker (recommended)
```bash
npm run docker:up
# Wait for services to start, then:
npm run db:migrate
npm run db:seed
```

### 3. Or run locally (requires local PostgreSQL)
```bash
# Install all dependencies
npm install

# Backend
cd apps/backend
npm run prisma:migrate
npm run prisma:seed

# Start backend
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend
```

## Default Accounts (after seed)

| Role    | Email                | Password     |
|---------|----------------------|--------------|
| Admin   | admin@eedemo.com     | Admin@123    |
| Teacher | teacher@eedemo.com   | Teacher@123  |
| Student | student@eedemo.com   | Student@123  |

## API Endpoints

### Auth
| Method | Path                  | Auth | Description        |
|--------|-----------------------|------|--------------------|
| POST   | /api/auth/login       | No   | Login              |
| POST   | /api/auth/refresh     | No   | Refresh access token|
| POST   | /api/auth/logout      | Yes  | Logout (revoke RT) |

### Users
| Method | Path                  | Auth    | Description        |
|--------|-----------------------|---------|--------------------|
| GET    | /api/users/me         | Any     | Get my profile     |
| GET    | /api/users            | ADMIN   | List all users     |

## Development Commands

```bash
# Docker
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:logs      # Follow logs

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed demo data
npm run db:studio        # Open Prisma Studio

# Individual apps
npm run dev:backend
npm run dev:frontend
```
