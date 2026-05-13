# Prisma Commands Complete Guide

## Project Overview

This guide explains:

* Which Prisma command to use
* When to use it
* What each command does
* Development workflow
* Production workflow
* Best practices

---

# Package.json Scripts

```json
"scripts": {
  "dev": "npm run prisma:generate && nodemon app.js",
  "start": "node app.js",

  "prisma:init": "prisma init",
  "prisma:generate": "prisma generate",

  "prisma:migrate": "prisma migrate dev",
  "prisma:migrate:init": "prisma migrate dev --name init",
  "prisma:deploy": "prisma migrate deploy",

  "prisma:push": "prisma db push",
  "prisma:reset": "prisma migrate reset",

  "prisma:studio": "prisma studio",
  "prisma:seed": "node prisma/seed.js",

  "postinstall": "prisma generate"
}
```

---

# 1. Install Dependencies

## Command

```bash
npm install
```

## Use Case

Use this when:

* You cloned the project
* You pulled latest code from Git
* node_modules folder is missing

## What It Does

* Installs all dependencies
* Automatically runs:

```bash
prisma generate
```

because of:

```json
"postinstall": "prisma generate"
```

---

# 2. Initialize Prisma

## Command

```bash
npm run prisma:init
```

## Use Case

Use only once when setting up Prisma for the first time.

## What It Does

Creates:

* prisma/schema.prisma
* .env file

---

# 3. Generate Prisma Client

## Command

```bash
npm run prisma:generate
```

## Use Case

Use this when:

* Prisma schema changed
* Prisma client types are outdated
* Auto-completion is not working
* You pulled latest schema changes from Git
* Prisma client errors appear

## What It Does

Generates updated Prisma Client.

---

# 4. Create Migration (Development)

## Command

```bash
npm run prisma:migrate -- --name your_migration_name
```

## Example

```bash
npm run prisma:migrate -- --name add_user_phone
```

## Use Case

Use this whenever you modify schema.prisma.

## What It Does

* Creates migration files
* Updates database tables
* Generates Prisma Client

## Recommended For

Development environment.

---

# 5. First Migration Setup

## Command

```bash
npm run prisma:migrate:init
```

## Use Case

Use this only once for the initial database setup.

## What It Does

* Creates initial migration
* Creates database tables
* Generates Prisma Client

---

# 6. Push Schema Without Migration

## Command

```bash
npm run prisma:push
```

## Use Case

Use this for:

* Quick testing
* Prototype development
* Temporary schema updates

## What It Does

* Directly updates database schema
* Does NOT create migration history

## Important

Avoid using this in production.

---

# 7. Open Prisma Studio

## Command

```bash
npm run prisma:studio
```

## Use Case

Use this to manage database records visually.

## What It Does

Opens Prisma Studio in browser.

Features:

* View tables
* Edit records
* Delete records
* Insert new data

---

# 8. Reset Database

## Command

```bash
npm run prisma:reset
```

## Use Case

Use this when:

* Database is corrupted
* You want fresh database setup
* Testing from scratch

## What It Does

* Deletes all data
* Re-runs migrations
* Recreates database structure

## Warning

This removes all existing data.

---

# 9. Run Seed File

## Command

```bash
npm run prisma:seed
```

## Use Case

Use this to insert default data.

## Examples

* SUPER_ADMIN user
* Default settings
* Initial roles
* Test users

---

# 10. Production Migration

## Command

```bash
npm run prisma:deploy
```

## Use Case

Use this in:

* Production server
* Live deployment
* CI/CD pipeline

## What It Does

* Applies existing migrations
* Does NOT create new migrations

## Important

Always use this in production instead of:

```bash
prisma migrate dev
```

---

# 11. Start Development Server

## Command

```bash
npm run dev
```

## Use Case

Use during development.

## What It Does

Automatically:

1. Runs Prisma Generate
2. Starts Nodemon server

Equivalent to:

```bash
npm run prisma:generate && nodemon app.js
```

---

# 12. Start Production Server

## Command

```bash
npm start
```

## Use Case

Use this in production.

---

# Recommended Development Workflow

## Step 1 → Update Schema

Example:

```prisma
model User {
  id    String @id @default(uuid())
  phone String?
}
```

---

## Step 2 → Create Migration

```bash
npm run prisma:migrate -- --name add_phone
```

---

## Step 3 → Start Server

```bash
npm run dev
```

---

# Recommended Git Pull Workflow

## Step 1

```bash
git pull
```

---

## Step 2

```bash
npm install
```

Automatically runs:

```bash
prisma generate
```

---

## Step 3

```bash
npm run prisma:deploy
```

---

## Step 4

```bash
npm run dev
```

---

# Recommended Production Workflow

## Step 1

```bash
npm install
```

---

## Step 2

```bash
npm run prisma:deploy
```

---

## Step 3

```bash
npm start
```

---

# Best Practices

## Development

Use:

```bash
prisma migrate dev
```

---

## Production

Use:

```bash
prisma migrate deploy
```

---

## Avoid In Production

Do NOT use:

```bash
prisma db push
```

because it does not maintain migration history.

---

# Most Commonly Used Commands

| Purpose                | Command                                           |
| ---------------------- | ------------------------------------------------- |
| Start Dev Server       | `npm run dev`                                     |
| Create Migration       | `npm run prisma:migrate -- --name migration_name` |
| Generate Prisma Client | `npm run prisma:generate`                         |
| Open Prisma Studio     | `npm run prisma:studio`                           |
| Production Migration   | `npm run prisma:deploy`                           |
| Reset Database         | `npm run prisma:reset`                            |
| Quick Schema Sync      | `npm run prisma:push`                             |
| Run Seed File          | `npm run prisma:seed`                             |

---

# Environment Variables Example

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_calling_system"
JWT_SECRET="your_jwt_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
```
