// gateway/app.js
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ─── Service Map (matches your actual .env PORTs) ──────────────
const SERVICES = {
  "/api/auth":         "http://localhost:5001",  // auth-service
  "/api/user":         "http://localhost:5002",  // user-service
  "/api/subscription": "http://localhost:5003",  // subscription-service
  // "/api/":             "http://localhost:5004",  // your 4th service
};

// ─── Logger ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[Gateway] ${req.method} ${req.url}`);
  next();
});

// ─── Proxy Routes ──────────────────────────────────────────────
Object.entries(SERVICES).forEach(([prefix, target]) => {
  app.use(
    prefix,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: {
        [`^${prefix}`]: "", // important fix
      },
      on: {
        error: (err, _req, res) => {
          console.error(`[Gateway] ${prefix} → ${target} failed:`, err.message);
          res.status(502).json({ error: "Service unavailable", service: prefix });
        },
      },
    })
  );
});

// ─── Health Check ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", port: 5000, routes: Object.keys(SERVICES) });
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

app.listen(5000, () => {
  console.log("\n🚀 API Gateway → http://localhost:5000");
  Object.entries(SERVICES).forEach(([prefix, target]) =>
    console.log(`   ${prefix.padEnd(22)} →  ${target}`)
  );
});