# 🚀 SaaS Microservices Backend – Complete Documentation

This project is a **SaaS-based microservices architecture** built using:

* Node.js + Express
* Prisma ORM
* PostgreSQL (separate DB per service)
* JWT आधारित authentication

---

# 🧠 Architecture Overview

## 🧩 Services

| Service              | Purpose                     |
| -------------------- | --------------------------- |
| Auth Service         | Authentication (login, JWT) |
| User Service         | Organization + Users        |
| Subscription Service | Plans + Billing             |
| Notification Service | Email + Logs                |
| API Gateway          | Entry point + routing       |

---

# 🔗 System Flow

```
Client → API Gateway → Service → Database
```

---

# 🔥 Complete Workflow

## 🥇 1. User Signup Flow

```
Client
 ↓
Auth Service → create user → returns authUserId + token
 ↓
User Service → create organization + user profile
 ↓
Notification Service → send welcome email
```

---

## 🥈 2. Login Flow

```
Client → Auth Service → verify credentials → return JWT
```

---

## 🥉 3. Create Organization

```
User (ORG_ADMIN)
 ↓
User Service → create organization
```

---

## 🏅 4. Subscription Flow

```
SUPER_ADMIN → create plans
ORG_ADMIN → subscribe to plan
```

---

## 🎖️ 5. Add Users

```
User Service
 ↓
Check subscription limit (Subscription Service)
 ↓
Create user
```

---

# 🔐 AUTH SERVICE

## Base URL

```
/api/auth
```

---

## 📌 1. Register

### POST `/register`

```json
{
  "email": "admin@test.com",
  "password": "123456",
  "role": "SUPER_ADMIN"
}
```

### Response

```json
{
  "userId": "auth_123",
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

---

## 📌 2. Login

### POST `/login`

```json
{
  "email": "admin@test.com",
  "password": "123456"
}
```

---

## 📌 3. Get Current User

### GET `/me`

Headers:

```
Authorization: Bearer TOKEN
```

---

## 📌 4. Refresh Token

### POST `/refresh`

---

## 📌 5. Logout

### POST `/logout`

---

# 👥 USER SERVICE

## Base URL

```
/api/user
```

---

## 📌 1. Create Organization

### POST `/organization`

```json
{
  "name": "My Company",
  "industry": "IT",
  "companySize": "10-50"
}
```

---

## 📌 2. Create User

### POST `/user`

```json
{
  "authUserId": "auth_123",
  "organizationId": "org_123",
  "firstName": "Aman",
  "lastName": "Kumar",
  "email": "aman@test.com",
  "role": "AGENT"
}
```

---

## 📌 3. Get Users

### GET `/users/:orgId`

---

## 📌 4. Update User

### PUT `/user/:id`

---

## 📌 5. Delete User

### DELETE `/user/:id`

---

# 💰 SUBSCRIPTION SERVICE

## Base URL

```
/api/subscription
```

---

## 📌 1. Create Plan (SUPER_ADMIN)

### POST `/plan`

```json
{
  "name": "Starter",
  "priceMonthly": 499,
  "priceYearly": 4999,
  "userLimit": 10
}
```

---

## 📌 2. Get Plans

### GET `/plans`

---

## 📌 3. Subscribe

### POST `/subscribe`

```json
{
  "orgId": "org_123",
  "planId": "plan_123"
}
```

---

## 📌 4. Get Subscription

### GET `/subscription/:orgId`

---

## 📌 5. Check User Limit

### GET `/check-limit/:orgId`

---

# 🔔 NOTIFICATION SERVICE

## Base URL

```
/api/notification
```

---

## 📌 1. Send Email

### POST `/send-email`

```json
{
  "to": "user@test.com",
  "subject": "Welcome",
  "message": "<h1>Hello</h1>"
}
```

---

## 📌 2. Get Notifications

### GET `/my`

---

## 📌 3. Create Notification

### POST `/create`

---

## 📌 4. Retry Failed

### POST `/retry`

---

# 🚀 API GATEWAY

## Base URL

```
http://localhost:3000
```

---

## Routing

| Route             | Service              |
| ----------------- | -------------------- |
| /api/auth         | Auth Service         |
| /api/user         | User Service         |
| /api/subscription | Subscription Service |
| /api/notification | Notification Service |

---

# 🔐 JWT Structure

```json
{
  "userId": "auth_123",
  "role": "ORG_ADMIN"
}
```

---

# 🗄️ DATABASE DESIGN

## Separate DB per service

| Service      | DB              |
| ------------ | --------------- |
| Auth         | auth_db         |
| User         | user_db         |
| Subscription | subscription_db |
| Notification | notification_db |

---

# 🔗 Inter-Service Communication

* REST APIs (current)
* Future: Event आधारित (Kafka / RabbitMQ)

---

# ⚠️ Important Rules

❌ No DB sharing
❌ No cross-service joins
✅ Use API communication

---

# 🧪 Testing Flow (Step-by-Step)

1. Register user
2. Login
3. Create organization
4. Create plan
5. Subscribe
6. Add users

---

# 🔥 Production Improvements

* Rate limiting
* Logging system
* Email templates
* Payment gateway (Stripe)
* Queue system

---

# 💥 Final Summary

This system provides:

✅ Multi-tenant SaaS architecture
✅ Scalable microservices
✅ Role-based access
✅ Subscription-based control
✅ Notification system

---

# 🚀 Next Steps

* Docker setup
* CI/CD pipeline
* Frontend integration
* Event-driven architecture

---

👉 You now have a **complete SaaS backend architecture ready for production scaling** 🔥



# 📖 SaaS System Story Flow (Real World Scenario)

Socho tumne ek SaaS product banaya hai — aur ab ek company usko use karne wali hai…

---

## 🎬 Scene 1: Platform Owner (SUPER ADMIN)

Ek banda hai — **tum (platform owner)**

👉 Tum sabse pehle system me aate ho

* Tum Auth Service pe jaake register karte ho
* Tumhara role hota hai: `SUPER_ADMIN`

👉 Ab tumhare paas full control hai system ka

---

## 🎬 Scene 2: Plans Banana (Business Setup)

Tum sochte ho:

> “Agar log mera SaaS use karenge, toh unhe plans dene padenge”

👉 Tum Subscription Service me jaake plan banate ho:

* Starter Plan (5 users)
* Pro Plan (20 users)

👉 Ab system ready hai customers ke liye 💰

---

## 🎬 Scene 3: Customer Entry (ORG ADMIN Signup)

Ab ek company aati hai — maan lo:

👉 **“ABC Pvt Ltd”**

Unka owner aata hai:

* Wo Auth Service me register karta hai
* Role: `ORG_ADMIN`

👉 Ab wo system me login kar leta hai

---

## 🎬 Scene 4: Company Setup (Organization Create)

Login ke baad wo bolta hai:

> “Mujhe apni company setup karni hai”

👉 Wo User Service me jaata hai

* Organization create karta hai
* “ABC Pvt Ltd”

👉 System ek `orgId` generate karta hai

---

## 🎬 Scene 5: Owner Profile Create

👉 Ab uska Auth user already bana hua hai
👉 Ab wo apni profile create karta hai User Service me

* authUserId link hota hai
* organizationId attach hota hai

👉 Ab wo officially company ka admin ban gaya ✅

---

## 🎬 Scene 6: Plan Purchase (Subscription Start)

Ab wo sochta hai:

> “Mujhe team add karni hai”

👉 Wo Subscription Service me jaake:

* Starter Plan purchase karta hai

👉 Ab usko milta hai:

* max 5 users allowed

---

## 🎬 Scene 7: Team Build Karna (Users Add)

Ab wo apni team banana start karta hai:

### 👨‍💼 Step 1:

Ek employee add karta hai

* Pehle Auth Service me user create hota hai
* Fir User Service me profile create hoti hai

👉 System check karta hai:

* current users < plan limit ✔️

---

### 👨‍💼 Step 2:

Wo aur users add karta hai…

👉 Jab 5 users ho jaate hain:

System bolta hai:

> ❌ “User limit reached”

---

## 🎬 Scene 8: Upgrade Moment 🚀

Ab company grow karti hai

👉 Wo plan upgrade karta hai:

* Starter → Pro

👉 Ab wo 20 users add kar sakta hai

---

## 🎬 Scene 9: Notifications 🔔

Jab bhi:

* User add hota hai
* Plan purchase hota hai

👉 Notification Service email bhejti hai:

> “Welcome to ABC Pvt Ltd”

---

## 🎬 Final Scene: System Live 🚀

Ab system fully chal raha hai:

* Auth → login handle kar raha hai
* User → company + users manage kar raha hai
* Subscription → limits control kar raha hai
* Notification → communication handle kar raha hai

---

# 🧠 Whole Story in One Line

👉

```text
Platform create → Plans create → Company signup → Org create → Plan purchase → Users add → System run
```

---

# 💥 Important Learning

👉 Is story se yaad rakhna:

* Auth bina kuch nahi
* Org bina user nahi
* Plan bina scaling nahi
* Subscription bina control nahi

---

# 🚀 Tum kya bana chuke ho

👉 Ye koi normal backend nahi hai
👉 Tumne ek **complete SaaS engine** bana diya hai 🔥

---

Agar chaho next main:

👉 is story ko **diagram + flowchart** me convert kar deta hoon
👉 ya ek **single signup API (auto flow)** bana deta hoon

Bas bolo 😄



# 📖 SaaS System Story (Step-by-Step Real Flow)

Imagine you’ve built your own SaaS product…
Now let’s walk through **how it actually works in real life** 👇

---

## 🎬 Scene 1: You – The Platform Owner (SUPER ADMIN)

You are the owner of the platform.

👉 First, you enter your system:

* You register using the Auth Service
* Your role is: `SUPER_ADMIN`

Now you have **full control over the entire platform** 🔐

---

## 🎬 Scene 2: Creating Plans (Business Setup)

You think:

> “If companies are going to use my SaaS, I need pricing plans”

👉 So you go to the Subscription Service and create:

* Starter Plan → 5 users
* Pro Plan → 20 users

Now your system is **ready to sell** 💰

---

## 🎬 Scene 3: A Customer Arrives (ORG ADMIN Signup)

A company joins your platform:

👉 Let’s say: **ABC Pvt Ltd**

The company owner:

* Registers via Auth Service
* Role: `ORG_ADMIN`

Now they can log in to your system.

---

## 🎬 Scene 4: Setting Up Their Company (Organization)

After login, they think:

> “I need to set up my company inside this system”

👉 They go to User Service and:

* Create an organization → “ABC Pvt Ltd”

👉 System generates an `orgId`

---

## 🎬 Scene 5: Creating Their Profile

Now:

* Their Auth account already exists
* They create their **user profile** in User Service

👉 This links:

* `authUserId` → from Auth Service
* `organizationId` → from User Service

Now they officially become the **admin of their company** ✅

---

## 🎬 Scene 6: Buying a Plan (Subscription)

Now they want to add their team.

👉 They go to Subscription Service:

* Purchase Starter Plan

👉 Now system knows:

* This company can have **max 5 users**

---

## 🎬 Scene 7: Building Their Team (Adding Users)

The company starts adding employees 👇

---

### 👨‍💼 Step 1: Add First User

* First → create user in Auth Service
* Then → create profile in User Service

👉 System checks:

* Current users < limit ✔️ → Allowed

---

### 👨‍💼 Step 2: Keep Adding Users

They keep adding users…

👉 When they reach 5 users:

System stops them:

> ❌ “User limit reached”

---

## 🎬 Scene 8: Upgrade Plan 🚀

Company grows 📈

👉 They upgrade:

* Starter → Pro Plan

👉 Now they can add up to **20 users**

---

## 🎬 Scene 9: Notifications 🔔

Whenever something happens:

* New user added
* Subscription created

👉 Notification Service sends emails:

> “Welcome to ABC Pvt Ltd”

---

## 🎬 Final Scene: System Fully Running 🚀

Now everything works together:

* Auth Service → handles login & security
* User Service → manages company & users
* Subscription Service → controls plans & limits
* Notification Service → sends communication

---

# 🧠 Entire System in One Line

```text
Platform setup → Plans created → Company signup → Organization created → Subscription purchased → Users added → System running
```

---

# 💥 Key Takeaways

* No Auth → nothing works
* No Organization → users cannot exist
* No Subscription → no scaling control
* No Limits → SaaS breaks

---

# 🚀 What You Have Built

👉 This is not just a backend
👉 You’ve built a **complete SaaS engine** 🔥

---

If you want next:

* I can convert this into a **diagram / architecture chart**
* Or build a **single signup API (auto flow: auth + org + user)**

Just tell me 👍
