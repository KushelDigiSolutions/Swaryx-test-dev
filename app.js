import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import proxy from "express-http-proxy";
import dotenv from "dotenv";
import crypto from "crypto";
import hpp from "hpp";

dotenv.config();

const app = express();

// ======================================================
// TRUST PROXY
// ======================================================

app.set("trust proxy", 1);

// ======================================================
// SECURITY HEADERS
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);

// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ======================================================
// COMPRESSION
// ======================================================

app.use(compression());

// ======================================================
// HTTP PARAM POLLUTION PROTECTION
// ======================================================

app.use(hpp());

// ======================================================
// REQUEST ID MIDDLEWARE
// ======================================================

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();

  res.setHeader("X-Request-Id", req.requestId);

  next();
});

// ======================================================
// LOGGING
// ======================================================

morgan.token("id", (req) => req.requestId);

app.use(
  morgan(
    "[:id] :method :url :status :response-time ms - :res[content-length]"
  )
);

// ======================================================
// RATE LIMITER
// ======================================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests",
  },
});

app.use(limiter);

// ======================================================
// SLOW DOWN ATTACK PROTECTION
// ======================================================

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 500,
});

app.use(speedLimiter);

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "API Gateway",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date(),
  });
});

// ======================================================
// PROXY OPTIONS
// ======================================================

const proxyOptions = (basePath) => ({
  proxyReqPathResolver: (req) => {
    return `${basePath}${req.url}`;
  },

  timeout: 30000,

  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers["x-request-id"] = srcReq.requestId;
    proxyReqOpts.headers["x-forwarded-host"] = srcReq.hostname;
    proxyReqOpts.headers["x-forwarded-proto"] = srcReq.protocol;

    if (srcReq.headers.authorization) {
      proxyReqOpts.headers.authorization =
        srcReq.headers.authorization;
    }

    return proxyReqOpts;
  },

  proxyErrorHandler: (err, res) => {
    console.error("Proxy Error:", err.message);

    return res.status(503).json({
      success: false,
      message: "Microservice unavailable",
      error: err.message,
    });
  },

  userResDecorator: async (
    proxyRes,
    proxyResData,
    userReq,
    userRes
  ) => {
    userRes.setHeader("X-Powered-By", "Swaryx-Gateway");

    return proxyResData;
  },
});

// ======================================================
// AUTH SERVICE
// ======================================================

app.use(
  "/api/auth",
  proxy(
    process.env.AUTH_SERVICE_URL || "http://localhost:5001",
    proxyOptions("/api/auth")
  )
);

// ======================================================
// USER SERVICE
// ======================================================

app.use(
  "/api/users",
  proxy(
    process.env.USER_SERVICE_URL || "http://localhost:5002",
    proxyOptions("/api/users")
  )
);

// ======================================================
// NOTIFICATION SERVICE
// ======================================================

app.use(
  "/api/notifications",
  proxy(
    process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5003",
    proxyOptions("/api/notifications")
  )
);

// ======================================================
// SUBSCRIPTION SERVICE
// ======================================================

app.use(
  "/api/subscription",
  proxy(
    process.env.SUBSCRIPTION_SERVICE_URL || "http://localhost:5004",
    proxyOptions("/api/subscription")
  )
);

// ======================================================
// LEAD SERVICE
// ======================================================

app.use(
  "/api/leads",
  proxy(
    process.env.USER_SERVICE_URL || "http://localhost:5005",
    proxyOptions("/api/users")
  )
);

// ======================================================
// CALLING SERVICE
// ======================================================

app.use(
  "/api/calls",
  proxy(
    process.env.USER_SERVICE_URL || "http://localhost:5006",
    proxyOptions("/api/users")
  )
);

// ======================================================
// 404
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    requestId: req.requestId,
  });
});

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.on("SIGINT", () => {
  console.log("SIGINT RECEIVED");

  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM RECEIVED");

  process.exit(0);
});

// ======================================================
// UNCAUGHT ERROR HANDLING
// ======================================================

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

// ======================================================
// SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
==========================================
🚀 Swaryx API Gateway Running
🌐 PORT: ${PORT}
==========================================
`);
});