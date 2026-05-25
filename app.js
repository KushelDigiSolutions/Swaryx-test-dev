import express from "express";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();

///////////////////////////////////////////////////////////
// SERVICE URLs
///////////////////////////////////////////////////////////

const SERVICES = {
  AUTH:         process.env.AUTH_SERVICE_URL         || "http://localhost:5001",
  USER:         process.env.USER_SERVICE_URL         || "http://localhost:5002",
  SUBSCRIPTION: process.env.SUBSCRIPTION_SERVICE_URL || "http://localhost:5003",
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5004",
};

///////////////////////////////////////////////////////////
// MIDDLEWARE
///////////////////////////////////////////////////////////

app.use(cors());
app.use(express.json());

///////////////////////////////////////////////////////////
// REQUEST LOGGER
///////////////////////////////////////////////////////////

app.use((req, _res, next) => {
  console.log(`[API GATEWAY] ${req.method} ${req.url}`);
  next();
});

///////////////////////////////////////////////////////////
// RATE LIMITER
///////////////////////////////////////////////////////////

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

app.use(limiter);

///////////////////////////////////////////////////////////
// JWT VERIFY MIDDLEWARE
///////////////////////////////////////////////////////////

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Access token not provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.headers["x-user-id"]   = decoded.userId;
    req.headers["x-user-role"] = decoded.role;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

///////////////////////////////////////////////////////////
// PROXY HELPER
///////////////////////////////////////////////////////////

const createProxy = (target, pathFilter) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    on: {
      proxyReq: (_proxyReq, req) => {
        console.log(`[PROXY ->] ${req.method} ${req.url} -> ${target}`);
      },
      error: (err, _req, res) => {
        console.error(`[PROXY ERROR] ${err.message}`);
        res.status(502).json({ success: false, message: "Service unavailable." });
      },
    },
  });

///////////////////////////////////////////////////////////
// HEALTH CHECK
///////////////////////////////////////////////////////////

app.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    service: "API Gateway",
    status: "Running",
    services: SERVICES,
  });
});

app.get("/", (_req, res) => res.send("API Gateway Running..."));

///////////////////////////////////////////////////////////
// POST /api/auth/register
//
// 1. Register user in Auth Service
// 2. User Service profile is created automatically by Auth Service
//    via internal call — no separate call needed here
// 3. Return enriched response with tokens
///////////////////////////////////////////////////////////

app.post("/api/auth/register", async (req, res) => {
  try {
    const authResponse = await axios.post(
      `${SERVICES.AUTH}/api/auth/register`,
      req.body,
      { headers: { "Content-Type": "application/json" } }
    );

    return res.status(authResponse.status).json(authResponse.data);
  } catch (error) {
    const status  = error?.response?.status  || 500;
    const message = error?.response?.data?.message || "Registration failed";
    return res.status(status).json({ success: false, message });
  }
});

///////////////////////////////////////////////////////////
// POST /api/auth/login
//
// 1. Login via Auth Service → get tokens
// 2. Decode token → get userId, role
// 3. Fetch UserProfile from User Service
// 4. Fetch Organization (if user belongs to one)
// 5. Fetch Subscription + Plan limits (if org exists)
// 6. Return all data in one enriched response
///////////////////////////////////////////////////////////

app.post("/api/auth/login", async (req, res) => {
  try {
    // Step 1: Auth Service login
    const authResponse = await axios.post(
      `${SERVICES.AUTH}/api/auth/login`,
      req.body,
      { headers: { "Content-Type": "application/json" } }
    );

    const { accessToken, refreshToken, userId, role } = authResponse.data.data;
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let userProfile  = null;
    let organization = null;
    let subscription = null;

    // Step 2: Fetch UserProfile from User Service
    try {
      const userRes = await axios.get(
        `${SERVICES.USER}/api/users/profile/me`,
        { headers: authHeader }
      );
      userProfile = userRes.data?.data || null;
    } catch (userErr) {
      console.warn("[GATEWAY] UserProfile fetch failed:", userErr?.response?.data || userErr.message);
    }

    // Step 3: Fetch Organization + Subscription if user belongs to one
    const orgId = userProfile?.organizationId;

    if (orgId) {
      // Fetch org details
      try {
        const orgRes = await axios.get(
          `${SERVICES.USER}/api/users/organizations/mine`,
          { headers: authHeader }
        );
        organization = orgRes.data?.data || null;
      } catch {
        console.warn("[GATEWAY] Organization fetch failed");
      }

      // Fetch subscription + plan limits
      try {
        const subRes = await axios.get(
          `${SERVICES.SUBSCRIPTION}/api/subscriptions/mine`,
          { headers: authHeader }
        );
        subscription = subRes.data?.data || null;
      } catch {
        console.warn("[GATEWAY] Subscription fetch failed");
      }
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: authResponse.data.data?.mustChangePassword ?? false,
        user: {
          ...userProfile,
          userId,
          role,
        },
        organization: organization || null,
        subscription: subscription || null,
      },
    });
  } catch (error) {
    const status  = error?.response?.status  || 500;
    const message = error?.response?.data?.message || "Login failed";
    return res.status(status).json({ success: false, message });
  }
});

///////////////////////////////////////////////////////////
// POST /api/users/organizations/:id/users/provision
//
// Provision a new user directly into an org (ORG_ADMIN only).
// Gateway verifies the token and proxies to User Service.
// Handled separately to ensure verifyToken runs first.
///////////////////////////////////////////////////////////

app.post(
  "/api/users/organizations/:id/users/provision",
  verifyToken,
  (req, res, next) => {
    // Rebuild the URL with the captured param before proxying
    req.url = `/api/users/organizations/${req.params.id}/users/provision`;
    next();
  },
  createProxy(SERVICES.USER, (p) => p.includes("/users/provision"))
);

///////////////////////////////////////////////////////////
// PUBLIC ROUTES — No token required
///////////////////////////////////////////////////////////

// Auth: token refresh, email verification, password reset
app.use(
  createProxy(SERVICES.AUTH, [
    "/api/auth/refresh",
    "/api/auth/verify-email",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ])
);

// Invitation accept (public — user clicks link from email)
app.use(
  createProxy(SERVICES.USER, (p) => {
    return p.match(/^\/api\/users\/invitations\/[^/]+\/accept$/);
  })
);

// Invitation details (public — to show invite info before login)
app.use(
  createProxy(SERVICES.USER, (p) => {
    return p.match(/^\/api\/users\/invitations\/[^/]+$/) && !p.includes("/accept");
  })
);

// Subscription plans (public — pricing page)
app.use(
  createProxy(SERVICES.SUBSCRIPTION, ["/api/subscriptions/plans"])
);

///////////////////////////////////////////////////////////
// PROTECTED ROUTES — Token required
///////////////////////////////////////////////////////////

// ── Auth Service ─────────────────────────────────────────
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/auth")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.AUTH, (p) => p.startsWith("/api/auth"))
);

// ── User Service ─────────────────────────────────────────
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/users")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.USER, (p) => p.startsWith("/api/users"))
);

// ── Subscription Service ─────────────────────────────────
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/subscriptions")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.SUBSCRIPTION, (p) => p.startsWith("/api/subscriptions"))
);

// ── Notification Service ─────────────────────────────────
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/notifications")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.NOTIFICATION, (p) => p.startsWith("/api/notifications"))
);

///////////////////////////////////////////////////////////
// 404
///////////////////////////////////////////////////////////

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

///////////////////////////////////////////////////////////
// SERVER
///////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\nAPI Gateway running on port ${PORT}`);
  console.log(`\nProxying to:`);
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name.padEnd(14)} -> ${url}`);
  });
});