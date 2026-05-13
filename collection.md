# SaaS Microservices - Postman Collection

Save the below JSON as:

```bash
saas-microservices.postman_collection.json
```

Then import into Postman.

```json
{
  "info": {
    "name": "SaaS Microservices APIs",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": ""
    },
    {
      "key": "orgId",
      "value": ""
    },
    {
      "key": "planId",
      "value": ""
    },
    {
      "key": "userId",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Auth Service",
      "item": [
        {
          "name": "Register Super Admin",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"admin@test.com\",\n  \"password\": \"123456\",\n  \"role\": \"SUPER_ADMIN\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/register",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "register"
              ]
            }
          }
        },
        {
          "name": "Register Org Admin",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"company@test.com\",\n  \"password\": \"123456\",\n  \"role\": \"ORG_ADMIN\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/register",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "register"
              ]
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"admin@test.com\",\n  \"password\": \"123456\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/login",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "login"
              ]
            }
          }
        },
        {
          "name": "Get Current User",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/auth/me",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "me"
              ]
            }
          }
        },
        {
          "name": "Refresh Token",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"refreshToken\": \"YOUR_REFRESH_TOKEN\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/refresh",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "refresh"
              ]
            }
          }
        }
      ]
    },
    {
      "name": "User Service",
      "item": [
        {
          "name": "Create Organization",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"ABC Pvt Ltd\",\n  \"industry\": \"IT\",\n  \"companySize\": \"10-50\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/user/organization",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "user",
                "organization"
              ]
            }
          }
        },
        {
          "name": "Create User",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"authUserId\": \"AUTH_USER_ID\",\n  \"organizationId\": \"{{orgId}}\",\n  \"firstName\": \"Aman\",\n  \"lastName\": \"Kumar\",\n  \"email\": \"aman@test.com\",\n  \"role\": \"AGENT\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/user/user",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "user",
                "user"
              ]
            }
          }
        },
        {
          "name": "Get All Users",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/user/users/{{orgId}}",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "user",
                "users",
                "{{orgId}}"
              ]
            }
          }
        },
        {
          "name": "Update User",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"firstName\": \"Updated Name\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/user/user/{{userId}}",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "user",
                "user",
                "{{userId}}"
              ]
            }
          }
        },
        {
          "name": "Delete User",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/user/user/{{userId}}",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "user",
                "user",
                "{{userId}}"
              ]
            }
          }
        }
      ]
    },
    {
      "name": "Subscription Service",
      "item": [
        {
          "name": "Create Plan",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Starter\",\n  \"priceMonthly\": 499,\n  \"priceYearly\": 4999,\n  \"userLimit\": 5\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/subscription/plan",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "subscription",
                "plan"
              ]
            }
          }
        },
        {
          "name": "Get Plans",
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{baseUrl}}/api/subscription/plans",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "subscription",
                "plans"
              ]
            }
          }
        },
        {
          "name": "Subscribe Plan",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"orgId\": \"{{orgId}}\",\n  \"planId\": \"{{planId}}\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/subscription/subscribe",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "subscription",
                "subscribe"
              ]
            }
          }
        },
        {
          "name": "Get Subscription",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/subscription/subscription/{{orgId}}",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "subscription",
                "subscription",
                "{{orgId}}"
              ]
            }
          }
        },
        {
          "name": "Check User Limit",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/subscription/check-limit/{{orgId}}",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "subscription",
                "check-limit",
                "{{orgId}}"
              ]
            }
          }
        }
      ]
    },
    {
      "name": "Notification Service",
      "item": [
        {
          "name": "Send Email",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"to\": \"user@test.com\",\n  \"subject\": \"Welcome\",\n  \"message\": \"<h1>Welcome to our SaaS</h1>\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/notification/send-email",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "notification",
                "send-email"
              ]
            }
          }
        },
        {
          "name": "Get Notifications",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/notification/my",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "notification",
                "my"
              ]
            }
          }
        },
        {
          "name": "Retry Failed Notifications",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/notification/retry",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "notification",
                "retry"
              ]
            }
          }
        }
      ]
    }
  ]
}
```

---

# 🚀 Recommended API Execution Order

1. Register Super Admin
2. Login
3. Create Plan
4. Register Org Admin
5. Create Organization
6. Subscribe Plan
7. Create Users
8. Send Notifications
