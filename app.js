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

app.use(cors());

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
  } catch (error) {
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
// 📝 REGISTER — Enriched Response
//
// 1. Auth Service mein register karo
// 2. Token se userId, role nikalo
// 3. User Service mein profile auto-create karo
// 4. Enriched response bhejo
///////////////////////////////////////////////////////////

app.post("/api/auth/register", express.json(), async (req, res) => {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    // Step 1: Auth Service mein register karo
    const authResponse = await axios.post(
      `${SERVICES.AUTH}/api/auth/register`,
      { email, password, role },
      { headers: { "Content-Type": "application/json" } }
    );

    const { userId, accessToken, refreshToken } = authResponse.data.data;
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Step 2: User Service mein profile create karo
    let userProfile = null;
    try {
      const userRes = await axios.post(
        `${SERVICES.USER}/api/user/user`,
        {
          authUserId:  userId,
          email:       email,
          firstName:   firstName || email.split("@")[0],
          lastName:    lastName  || "",
          role:        role      || "ORG_ADMIN",
          // organizationId nahi dena — baad mein org create hogi
        },
        { headers: { ...authHeader, "Content-Type": "application/json" } }
      );
      userProfile = userRes.data?.user || null;
      console.log("[GATEWAY] User profile created in User Service ✅");
    } catch (userErr) {
      // Profile creation fail ho toh registration mat roko
      console.warn(
        "[GATEWAY] User profile creation failed:",
        userErr?.response?.data || userErr.message
      );
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId,
        accessToken,
        refreshToken,
        user: userProfile,
      },
    });

  } catch (error) {
    const status  = error?.response?.status  || 500;
    const message = error?.response?.data?.message || "Registration failed";
    return res.status(status).json({ success: false, message });
  }
});

///////////////////////////////////////////////////////////
// 🔐 LOGIN — Enriched Response
//
// 1. Auth Service se login karo → accessToken lo
// 2. Token decode karo → userId, role nikalo
// 3. User Service se profile fetch karo (authUserId se)
//    → nahi mila toh auto-create karo (purane users)
// 4. Org + Subscription fetch karo
// 5. Sab ek saath client ko bhejo
///////////////////////////////////////////////////////////

app.post("/api/auth/login", express.json(), async (req, res) => {
  try {
    // Step 1: Auth Service se login
    const authResponse = await axios.post(
      `${SERVICES.AUTH}/api/auth/login`,
      req.body,
      { headers: { "Content-Type": "application/json" } }
    );

    const { accessToken, refreshToken } = authResponse.data.data;

    // Step 2: Token decode karo
    const decoded = jwt.decode(accessToken);
    const userId  = decoded?.userId;   // yeh authUserId hai User Service ke liye
    const role    = decoded?.role;
    const email   = decoded?.email;

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let userProfile  = null;
    let organization = null;
    let subscription = null;
    let plan         = null;

    // Step 3: User profile fetch karo
    // GET /api/user/profile → authUserId se dhundta hai (correct!)
    try {
      const userRes = await axios.get(
        `${SERVICES.USER}/api/user/profile`,
        { headers: authHeader }
      );
      userProfile = userRes.data?.data || null;
    } catch (userErr) {
      console.warn(
        "[GATEWAY] User profile fetch failed:",
        userErr?.response?.data || userErr.message
      );

      // Purana user — User Service mein record nahi → auto-create karo
      try {
        const createRes = await axios.post(
          `${SERVICES.USER}/api/user/user`,
          {
            authUserId: userId,
            email:      email || "",
            firstName:  email ? email.split("@")[0] : "",
            lastName:   "",
            role:       role || "AGENT",
          },
          { headers: { ...authHeader, "Content-Type": "application/json" } }
        );
        userProfile = createRes.data?.user || null;
        console.log("[GATEWAY] User profile auto-created ✅");
      } catch (createErr) {
        console.warn(
          "[GATEWAY] User profile auto-create failed:",
          createErr?.response?.data || createErr.message
        );
      }
    }

    // Step 4: Organization fetch karo (agar organizationId ho)
    const orgId = userProfile?.organizationId;

    if (orgId) {
      try {
        const orgRes = await axios.get(
          `${SERVICES.USER}/api/user/organization/${orgId}`,
          { headers: authHeader }
        );
        organization = orgRes.data?.data || null;
      } catch {
        console.warn("[GATEWAY] Organization fetch failed");
      }

      // Step 5: Subscription fetch karo
      try {
        const subRes = await axios.get(
          `${SERVICES.SUBSCRIPTION}/api/subscription/subscription/${orgId}`,
          { headers: authHeader }
        );
        subscription = subRes.data || null;
      } catch {
        console.warn("[GATEWAY] Subscription fetch failed");
      }

      // Step 6: Plan limit details
      try {
        const planRes = await axios.get(
          `${SERVICES.SUBSCRIPTION}/api/subscription/check-limit/${orgId}`,
          { headers: authHeader }
        );
        plan = planRes.data || null;
      } catch {
        console.warn("[GATEWAY] Plan fetch failed");
      }
    }

    // Step 7: Enriched response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        user: {
          userId,
          role,
          ...userProfile,
        },
        organization: organization || null,
        subscription: subscription || null,
        plan:         plan         || null,
      },
    });

  } catch (error) {
    const status  = error?.response?.status  || 500;
    const message = error?.response?.data?.message || "Login failed";
    return res.status(status).json({ success: false, message });
  }
});

///////////////////////////////////////////////////////////
// PUBLIC ROUTES — Auth (no token needed)
///////////////////////////////////////////////////////////

app.use(
  createProxy(SERVICES.AUTH, [
    "/api/auth/refresh",
    "/api/auth/verify-email",
    "/api/auth/reset-password",
  ])
);

// Subscription plans (public)
app.use(
  createProxy(SERVICES.SUBSCRIPTION, ["/api/subscription/plans"])
);

///////////////////////////////////////////////////////////
// PROTECTED ROUTES
///////////////////////////////////////////////////////////

// Auth protected
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/auth")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.AUTH, ["/api/auth/me", "/api/auth/logout"])
);

// User Service
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/user")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.USER, (p) => p.startsWith("/api/user"))
);

// Subscription Service
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/subscription")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.SUBSCRIPTION, (p) => p.startsWith("/api/subscription"))
);

// Notification Service
app.use(
  (req, res, next) => {
    if (req.url.startsWith("/api/notification")) return verifyToken(req, res, next);
    next();
  },
  createProxy(SERVICES.NOTIFICATION, (p) => p.startsWith("/api/notification"))
);

///////////////////////////////////////////////////////////
// 404 ROUTE
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\nAPI Gateway running on port ${PORT}`);
  console.log(`\nProxying to:`);
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name.padEnd(14)} -> ${url}`);
  });
});