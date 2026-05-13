# 🚀 Swaryx Backend Microservices Architecture

A scalable Node.js microservices backend built with:

- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication
- API Gateway
- Notification Service
- Subscription Service
- User Service

---

# 📦 Services

| Service | Port | Description |
|---|---|---|
| API Gateway | 5000 | Main Gateway |
| Auth Service | 5001 | Authentication & JWT |
| User Service | 5002 | Users & Organizations |
| Subscription Service | 5003 | Plans & Subscriptions |
| Notification Service | 5004 | Email & Notifications |

---

# 📁 Project Structure

```txt
swaryx-backend/
│
├── api-gateway/
├── auth-service/
├── user-service/
├── subscription-service/
├── notification-service/
│
├── package.json
└── README.md
```

---

# ⚙️ Requirements

Install:

- Node.js v20+
- PostgreSQL
- npm

---

# 🔥 First Time Project Setup

## 1️⃣ Clone Repository

```bash
git clone YOUR_REPOSITORY_URL
```

---

## 2️⃣ Go To Project

```bash
cd swaryx-backend
```

---

## 3️⃣ Install Root Dependencies

```bash
npm install
```

---

## 4️⃣ Install All Service Dependencies

```bash
npm run install:all
```

---

# 🗄️ Database Setup

Create PostgreSQL databases manually.

Example:

```txt
auth_db
user_db
subscription_db
notification_db
```

---

# 🔐 Environment Variables

Each service should contain:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/auth_db"

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

PORT=5001
```

Update PORT according to service.

---

# 🔥 Prisma Commands

# Generate Prisma Client

Use after:

- schema changes
- fresh install
- git pull

```bash
npm run db:generate
```

---

# Create New Migration

Use when schema changes.

Inside service:

```bash
npm run prisma:migrate -- --name your_migration_name
```

Example:

```bash
npm run prisma:migrate -- --name add_notification_table
```

---

# Run All Migrations

```bash
npm run db:migrate
```

---

# Production Migration

Production should NEVER use:

```bash
prisma migrate dev
```

Use:

```bash
npm run db:deploy
```

---

# Push Schema Without Migration

Development only.

```bash
npm run db:push
```

---

# Reset Database

⚠️ Deletes all data.

```bash
npm run db:reset
```

---

# Open Prisma Studio

```bash
npm run db:studio
```

---

# 🚀 Running Services

# Run Entire Backend

Runs:

- Gateway
- Auth
- User
- Subscription
- Notification

```bash
npm run dev
```

---

# Run Single Service

## Gateway

```bash
npm run gateway
```

---

## Auth Service

```bash
npm run auth
```

---

## User Service

```bash
npm run user
```

---

## Subscription Service

```bash
npm run subscription
```

---

## Notification Service

```bash
npm run notification
```

---

# 🧪 Local Development Flow

# Step 1

Start PostgreSQL.

---

# Step 2

Run:

```bash
npm run install:all
```

---

# Step 3

Generate Prisma clients.

```bash
npm run db:generate
```

---

# Step 4

Run migrations.

```bash
npm run db:migrate
```

---

# Step 5

Start all services.

```bash
npm run dev
```

---

# 🌐 API Gateway

Main Entry Point:

```txt
http://localhost:5000
```

---

# 🔀 Gateway Routes

| Route | Target |
|---|---|
| /api/auth | Auth Service |
| /api/user | User Service |
| /api/subscription | Subscription Service |
| /api/notification | Notification Service |

---

# 🔥 Example APIs

## Register User

```http
POST http://localhost:5000/api/auth/register
```

---

## Login

```http
POST http://localhost:5000/api/auth/login
```

---

## Create Organization

```http
POST http://localhost:5000/api/user/organization
```

---

## Create Subscription

```http
POST http://localhost:5000/api/subscription/subscribe
```

---

## Send Notification

```http
POST http://localhost:5000/api/notification/send-email
```

---

# 🔔 Notification Flow

```txt
User Registers
      ↓
Auth Service
      ↓
Notification Service
      ↓
Welcome Email Sent
      ↓
Notification Saved
```

---

# 🔐 Authentication

Protected APIs require:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

# 🚀 Production Deployment

# Install Dependencies

```bash
npm run install:all
```

---

# Generate Prisma Client

```bash
npm run db:generate
```

---

# Run Production Migrations

```bash
npm run db:deploy
```

---

# Start Production Server

```bash
npm start
```

---

# ⚠️ Important Best Practices

# Development

Use:

```bash
prisma migrate dev
```

---

# Production

Use:

```bash
prisma migrate deploy
```

---

# Never Use In Production

```bash
prisma migrate reset
```

---

# After Git Pull

Always run:

```bash
npm run install:all
npm run db:generate
```

---

# 🧠 Recommended Future Improvements

- Docker
- Kubernetes
- Redis
- RabbitMQ
- BullMQ
- WebSockets
- CI/CD Pipeline
- Swagger Documentation
- Rate Limiting
- Monitoring

---

# 👨‍💻 Author

Swaryx Backend System
Built with Node.js + Prisma + PostgreSQL