# SaaS Backend — Complete API Route Map

## Port Layout
| Service | Port |
|---|---|
| API Gateway | 5000 |
| Auth Service | 5001 |
| User Service | 5002 |
| Subscription Service | 5003 |
| Notification Service | 5004 |

> **All client requests go through port 5000 (Gateway) only.**

---

## 🔐 AUTH SERVICE — /api/auth

| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| POST | /api/auth/register | ❌ | — | Register new user |
| POST | /api/auth/login | ❌ | — | Login, get tokens |
| POST | /api/auth/refresh | ❌ | — | Refresh access token |
| POST | /api/auth/logout | ✅ | Any | Logout, revoke session |
| POST | /api/auth/verify-email | ❌ | — | Verify email with token |
| POST | /api/auth/forgot-password | ❌ | — | Send reset email |
| POST | /api/auth/reset-password | ❌ | — | Reset password with token |
| GET | /api/auth/me | ✅ | Any | Current auth user info |
| GET | /api/auth/sessions | ✅ | Any | My active sessions |
| DELETE | /api/auth/sessions/:id | ✅ | Any | Revoke a session |
| POST | /api/auth/internal/verify-token | 🔒 | Internal | Validate JWT (inter-service) |

---

## 👤 USER SERVICE — /api/users

### Profile
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /api/users/profile/me | ✅ | Any | My profile |
| PATCH | /api/users/profile/me | ✅ | Any | Update my profile |
| GET | /api/users/profile/:userId | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Get any profile |

### Organization
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| POST | /api/users/organizations | ✅ | ORG_ADMIN+ | Create organization |
| GET | /api/users/organizations/mine | ✅ | Any | My organization |
| PATCH | /api/users/organizations/:id | ✅ | ORG_ADMIN+ | Update organization |
| GET | /api/users/organizations/:id/members | ✅ | ORG_MANAGER+ | List members |
| DELETE | /api/users/organizations/:id/members/:userId | ✅ | ORG_ADMIN+ | Remove member |

### Invitations
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| POST | /api/users/invitations | ✅ | ORG_MANAGER+ | Send invite |
| GET | /api/users/invitations/:token | ❌ | — | View invite details |
| POST | /api/users/invitations/:token/accept | ✅ | Any | Accept invite |
| DELETE | /api/users/invitations/:id | ✅ | ORG_MANAGER+ | Revoke invite |

### Admin
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /api/users/admin/users | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | List all users |
| GET | /api/users/admin/organizations | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | List all orgs |
| PATCH | /api/users/admin/users/:id/role | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Change user role |
| DELETE | /api/users/admin/users/:id | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Soft delete user |

### Internal
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/users/internal/create | 🔒 | Create profile (called by Auth) |
| GET | /api/users/internal/:authUserId | 🔒 | Get profile by authUserId |

---

## 💳 SUBSCRIPTION SERVICE — /api/subscriptions

### Plans (Public)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/subscriptions/plans | ❌ | List all plans |
| GET | /api/subscriptions/plans/:tier | ❌ | Get single plan |

### Subscription
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /api/subscriptions/mine | ✅ | Any | My subscription |
| POST | /api/subscriptions/upgrade | ✅ | ORG_ADMIN+ | Upgrade plan |
| POST | /api/subscriptions/cancel | ✅ | ORG_ADMIN+ | Cancel subscription |
| POST | /api/subscriptions/resume | ✅ | ORG_ADMIN+ | Resume subscription |
| PATCH | /api/subscriptions/billing-cycle | ✅ | ORG_ADMIN+ | Change monthly/yearly |

### Invoices
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/subscriptions/invoices | ✅ | My invoices (paginated) |
| GET | /api/subscriptions/invoices/:id | ✅ | Single invoice |

### Usage
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/subscriptions/usage/current | ✅ | Current period usage |

### Admin
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /api/subscriptions/admin/subscriptions | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | All subscriptions |
| PATCH | /api/subscriptions/admin/subscriptions/:id/plan | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Force plan change |
| GET | /api/subscriptions/admin/revenue | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Revenue summary |
 
### Internal
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/subscriptions/internal/initialize | 🔒 | Init subscription for new org |
| POST | /api/subscriptions/internal/usage | 🔒 | Log usage event |
| GET | /api/subscriptions/internal/:organizationId | 🔒 | Check limits |

---

## 🔔 NOTIFICATION SERVICE — /api/notifications

### In-App
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/notifications | ✅ | My notifications |
| PATCH | /api/notifications/read-all | ✅ | Mark all read |
| PATCH | /api/notifications/:id/read | ✅ | Mark one read |
| DELETE | /api/notifications/:id | ✅ | Delete notification |

### Preferences
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/notifications/preferences | ✅ | My preferences |
| PATCH | /api/notifications/preferences | ✅ | Update preferences |

### Admin
| Method | Route | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /api/notifications/admin/templates | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | List templates |
| POST | /api/notifications/admin/templates | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Create template |
| PATCH | /api/notifications/admin/templates/:id | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Update template |
| POST | /api/notifications/admin/broadcast | ✅ | SUPER_ADMIN, PLATFORM_ADMIN | Broadcast message |

### Internal
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/notifications/internal/welcome | 🔒 | Welcome on register |
| POST | /api/notifications/internal/reset-password | 🔒 | Password reset email |
| POST | /api/notifications/internal/invite | 🔒 | Org invite email |
| POST | /api/notifications/internal/send | 🔒 | Generic send |

---

## Role Hierarchy

```
SUPER_ADMIN        → Full access to everything
  └── PLATFORM_ADMIN → Platform management, all orgs
        └── SUPPORT_AGENT  → Read-only support access
              
ORG_ADMIN          → Owns org, manages members & billing
  └── ORG_MANAGER  → Manages members, invites
        └── ORG_USER → Regular end user
```

## Inter-Service Communication

```
Client
  └── API Gateway (5000)
        ├── Auth Service (5001)          ← register/login
        │     ├── → User Service         (auto-create profile)
        │     └── → Notification Service (welcome email)
        │
        ├── User Service (5002)          ← profile/org/invite
        │     ├── → Subscription Service (init plan on org create)
        │     └── → Notification Service (invite email)
        │
        ├── Subscription Service (5003)  ← plans/billing
        │     └── → Notification Service (billing events)
        │
        └── Notification Service (5004)  ← notifications
```

## Security Notes

- Internal routes use `x-internal-secret` header — **never expose to public**
- Refresh tokens are rotated on every use (rotation strategy)
- Accounts lock after 5 failed login attempts for 15 minutes
- Password resets invalidate all active sessions
- Soft deletes everywhere — no hard deletes in production