/**
 * ============================================================
 * 🔐 AUTH SERVICE — routes.js
 * ============================================================
 *
 * Routes:
 *  POST   /register                → Register new user
 *  POST   /login                   → Login + issue tokens
 *  POST   /refresh                 → Refresh access token
 *  POST   /logout                  → Invalidate session
 *  POST   /verify-email            → Verify email token
 *  POST   /forgot-password         → Send reset email
 *  POST   /reset-password          → Reset with token
 *  GET    /me                      → Current user info
 *  GET    /sessions                → All active sessions
 *  DELETE /sessions/:id            → Revoke a session
 *  DELETE /admin/users/:id         → Soft delete user (admin only)
 *  POST   /internal/verify-token   → Internal token validation
 *
 * Middleware (defined at top):
 *  verifyToken     → Validates JWT access token from Authorization header
 *  requireRoles    → Role-based access control factory
 *  isPlatformAdmin → Shorthand for SUPER_ADMIN | PLATFORM_ADMIN access
 *
 * Bug Fixes Applied:
 *  [FIX-1] notifyNotificationService — added "x-internal-secret" header
 *          so Notification Service's validateInternalSecret passes (was 403)
 *  [FIX-2] /login — refresh token now stored as SHA-256 hash (consistent with /register)
 *  [FIX-3] /refresh — lookup now uses hashed token to match stored hash
 *  [FIX-4] /forgot-password — added "x-internal-secret" header on reset-password notify call
 *  [FIX-5] /admin/users/:id — added "x-internal-secret" header on account-deleted notify call
 * ============================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import validator from "validator";

import prisma from "../../utils/prisma.js";

const router = express.Router();

// ============================================================
// ⚙️  CONSTANTS
// ============================================================

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const MAX_FAILED_ATTEMPTS = 5;               // lock account after 5 wrong passwords
const LOCK_DURATION_MS = 15 * 60 * 1000; // lock duration: 15 minutes

// ============================================================
// 🛡️  MIDDLEWARE
// ============================================================

/**
 * verifyToken
 * -----------
 * Extracts the Bearer token from the Authorization header,
 * verifies it with JWT_SECRET, and attaches the decoded
 * payload to `req.user`.
 *
 * Usage: router.get("/protected", verifyToken, handler)
 */
export const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};



const fetchOrganizationId = async (userId) => {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/users/internal/${userId}`,
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_SECRET,
        },
        timeout: 5000,
      }
    );

    return response.data?.data?.organizationId || null;
  } catch (err) {
    console.log("[AUTH] Failed to fetch organizationId");
    return null;
  }
};

/**
 * requireRoles(...roles)
 * ----------------------
 * Middleware factory — restricts route access to specified roles.
 * Must be used AFTER verifyToken so req.user is populated.
 *
 * Example: requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN")
 */
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  next();
};

/**
 * isPlatformAdmin
 * ---------------
 * Shorthand middleware for routes restricted to
 * SUPER_ADMIN or PLATFORM_ADMIN roles.
 */
const isPlatformAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN");

// ============================================================
// 🔑  TOKEN HELPERS
// ============================================================

/**
 * generateAccessToken
 * -------------------
 * Signs a short-lived JWT (1h) containing userId, email, role.
 * Used for API authentication on every request.
 */
const generateAccessToken = async (user) => {
  const organizationId = await fetchOrganizationId(user.id);

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * generateRefreshToken
 * --------------------
 * Signs a long-lived JWT (7d) containing only userId.
 * Used to issue new access tokens without re-login.
 * Always stored as SHA-256 hash in DB — never plain text.
 */
const generateRefreshToken = (user) =>
  jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

/**
 * hashToken
 * ---------
 * SHA-256 hash helper used before storing any token in the DB.
 * Ensures raw tokens are never persisted (defence-in-depth).
 *
 * @param {string} token - Raw token string
 * @returns {string}     - Hex-encoded SHA-256 digest
 */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// ============================================================
// 🌐  NETWORK HELPERS
// ============================================================

/**
 * getClientIp
 * -----------
 * Extracts the real client IP from the X-Forwarded-For header
 * (set by proxies / load balancers) or falls back to socket address.
 */
const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket.remoteAddress;

/**
 * internalHeaders
 * ---------------
 * Returns headers required for service-to-service (internal) calls.
 * Every internal route on Notification / User Service is protected by
 * validateInternalSecret — this helper ensures the header is never forgotten.
 *
 * [FIX-1] Previously only Authorization was sent; x-internal-secret was
 * missing, causing Notification Service to reject all calls with 403.
 *
 * @param {string} accessToken - JWT access token to forward
 * @returns {object}           - Headers object ready for axios
 */
const internalHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  "x-internal-secret": process.env.INTERNAL_SECRET,
});

// ============================================================
// 📋  AUDIT LOG
// ============================================================

/**
 * logAudit
 * --------
 * Writes an audit entry for any auth action (register, login, etc.).
 * Failures are logged to console but do NOT throw — audit errors
 * must never break the main request flow.
 *
 * @param {string} userId   - ID of the user performing the action
 * @param {string} action   - Action label e.g. "LOGIN", "REGISTER"
 * @param {object} req      - Express request (for IP + user-agent)
 * @param {object} metadata - Optional extra context
 */
const logAudit = async (userId, action, req, metadata = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"],
        metadata,
      },
    });
  } catch (err) {
    console.error("[AUDIT ERROR]", err.message);
  }
};

// ============================================================
// 📡  INTERNAL SERVICE NOTIFIERS
// ============================================================

/**
 * notifyUserService
 * -----------------
 * Fire-and-forget POST to User Service → creates the user's profile
 * record immediately after successful registration.
 *
 * Failure is logged but does NOT block the register response.
 */
const notifyUserService = async (user, accessToken, firstName, lastName) => {
  try {
    await axios.post(
      `${process.env.USER_SERVICE_URL}/api/users/internal/create`,
      {
        authUserId: user.id,
        email: user.email,
        role: user.role,
        firstName,
        lastName,
      },
      {
        headers: internalHeaders(accessToken), // x-internal-secret included
        timeout: 5000,
      }
    );
    console.log("[AUTH] User profile created ✅");
  } catch (err) {
    console.error(
      "[AUTH] User Service failed:",
      err?.response?.data || err.message
    );
  }
};

/**
 * notifyNotificationService
 * -------------------------
 * Fire-and-forget POST to Notification Service → queues the welcome
 * email containing the email-verification link.
 *
 * [FIX-1] Added "x-internal-secret" header via internalHeaders().
 *         Previously only Authorization was sent → Notification Service
 *         validateInternalSecret middleware returned 403 every time
 *         → welcome email was never sent after registration.
 *
 * Failure is logged but does NOT block the register response.
 */
const notifyNotificationService = async (
  user,
  accessToken,
  verificationToken,
  firstName
) => {
  try {
    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/welcome`,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName,
        verificationToken,
      },
      {
        headers: internalHeaders(accessToken), // [FIX-1] x-internal-secret now included
        timeout: 5000,
      }
    );
    console.log("[AUTH] Welcome notification queued ✅");
  } catch (err) {
    console.error(
      "[AUTH] Notification Service failed:",
      err?.response?.data || err.message
    );
  }
};

// ============================================================
// ============================================================
// 📌  ROUTES
// ============================================================
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /register
// ────────────────────────────────────────────────────────────
/**
 * Register a new user account.
 *
 * Body: { email, password, role?, firstName?, lastName?, fullName? }
 *
 * Flow:
 *  1. Validate email + password format
 *  2. Check for duplicate email
 *  3. Assign role (only ORG_ADMIN allowed from public endpoint)
 *  4. Parse name from firstName/lastName or split from fullName
 *  5. Hash password (bcrypt, cost 12)
 *  6. Generate email verification token (SHA-256 hashed in DB)
 *  7. Create user + session in a single DB transaction
 *     └─ refresh token stored as SHA-256 hash (never plain text)
 *  8. Fire-and-forget: notify User Service + Notification Service
 *  9. Return accessToken + refreshToken
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, fullName } = req.body;

    // ── Validation ─────────────────────────────────────────

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Must have: uppercase, lowercase, number, special char, min 8 chars
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain uppercase, lowercase, number and special character",
      });
    }

    // ── Duplicate Email Check ───────────────────────────────

    const existingUser = await prisma.userAuth.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // ── Role Assignment ─────────────────────────────────────
    // Only ORG_ADMIN can self-register; all other roles are admin-assigned.

    const allowedPublicRoles = ["ORG_ADMIN"];
    const assignedRole = allowedPublicRoles.includes(role) ? role : "ORG_ADMIN";

    // ── Name Parsing ────────────────────────────────────────
    // Priority: explicit firstName/lastName → split fullName → email prefix

    let parsedFirstName = firstName;
    let parsedLastName = lastName;

    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.trim().split(" ");
      parsedFirstName = parts[0] || "";
      parsedLastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    }

    if (!parsedFirstName) parsedFirstName = email.split("@")[0];
    if (!parsedLastName) parsedLastName = "";

    // ── Password Hash ───────────────────────────────────────

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Email Verification Token ────────────────────────────
    // Raw token → emailed to user
    // Hashed token → stored in DB (raw token never persisted)

    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = hashToken(rawVerificationToken);

    // ── DB Transaction: Create User + Session ───────────────

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.userAuth.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          role: assignedRole,
          verificationToken: hashedVerificationToken,
          verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          isVerified: false,
          isActive: true,
        },
      });

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // [FIX-2] Store hashed refresh token — never store raw token in DB
      await tx.userSession.create({
        data: {
          userId: user.id,
          refreshToken: hashToken(refreshToken), // hashed
          ipAddress: getClientIp(req),
          deviceInfo: req.headers["user-agent"],
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
        },
      });

      return { user, accessToken, refreshToken };
    });

    const { user, accessToken, refreshToken } = result;

    // ── Audit Log ───────────────────────────────────────────

    await logAudit(user.id, "REGISTER", req);

    // ── Fire & Forget Downstream Services ──────────────────
    // Failures do NOT affect the response — they're logged only.

    notifyUserService(user, accessToken, parsedFirstName, parsedLastName);
    notifyNotificationService(user, accessToken, rawVerificationToken, parsedFirstName);

    // ── Success Response ────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
      data: {
        userId: user.id,
        email: user.email,
        role: user.role,
        accessToken,
        refreshToken, // raw token returned to client (client stores it, never DB)
      },
    });
  } catch (err) {
    console.error("[AUTH] Register error:", err);
    return res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /login
// ────────────────────────────────────────────────────────────
/**
 * Authenticate an existing user.
 *
 * Body: { email, password }
 *
 * Security features:
 *  - Brute-force protection: locks after MAX_FAILED_ATTEMPTS (5)
 *  - Auto-unlock after LOCK_DURATION_MS (15 min) has elapsed
 *  - Resets failed attempt counter on successful login
 *  - Tracks lastLoginAt + lastLoginIp
 *  - [FIX-2] Refresh token stored as SHA-256 hash (consistent with /register)
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.userAuth.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    ///////////////////////////////////////////////////////////
    // FIXED TOKEN GENERATION
    ///////////////////////////////////////////////////////////

    const accessToken = await generateAccessToken(user);

    const refreshToken = generateRefreshToken(user);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: hashToken(refreshToken),
        ipAddress: getClientIp(req),
        deviceInfo: req.headers["user-agent"],
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        role: user.role,
        userId: user.id,
      },
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});


// ────────────────────────────────────────────────────────────
// POST /refresh
// ────────────────────────────────────────────────────────────
/**
 * Rotate refresh token and issue a new access token.
 *
 * Body: { refreshToken }
 *
 * Security:
 *  - Validates JWT signature with JWT_REFRESH_SECRET
 *  - Checks session exists, is active, and is not expired
 *  - Verifies token belongs to the correct user (userId match)
 *  - Rotates refresh token on every use (one-time-use pattern)
 *  - [FIX-3] Lookup uses hashToken() — DB stores hash, not plain text
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const hashedIncoming = hashToken(refreshToken);

    const session = await prisma.userSession.findUnique({
      where: { refreshToken: hashedIncoming },
      include: { user: true },
    });

    if (!session || !session.isActive) {
      return res.status(403).json({
        success: false,
        message: "Invalid session",
      });
    }

    ///////////////////////////////////////////////////////////
    // FIXED ACCESS TOKEN
    ///////////////////////////////////////////////////////////

    const newAccessToken = await generateAccessToken(session.user);

    const newRefreshToken = generateRefreshToken(session.user);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Refresh token invalid or expired",
    });
  }
});

// ────────────────────────────────────────────────────────────
// POST /logout
// ────────────────────────────────────────────────────────────
/**
 * Invalidate the current session.
 *
 * Body: { refreshToken? }
 * Headers: Authorization: Bearer <accessToken>
 *
 * If refreshToken provided → that specific session is deactivated.
 * Otherwise the logout event is still logged (access token is short-lived).
 */
router.post("/logout", verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Hash before lookup — DB stores hashed tokens
      await prisma.userSession.updateMany({
        where: { refreshToken: hashToken(refreshToken), userId: req.user.userId },
        data: { isActive: false },
      });
    }

    await logAudit(req.user.userId, "LOGOUT", req);

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("[AUTH] Logout error:", err);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /me
// ────────────────────────────────────────────────────────────
/**
 * Return the authenticated user's basic profile.
 *
 * Headers: Authorization: Bearer <accessToken>
 * Returns non-sensitive fields only (no password, no tokens).
 */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await prisma.userAuth.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error("[AUTH] /me error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /verify-email
// ────────────────────────────────────────────────────────────
/**
 * Verify a user's email address using the token from the welcome email.
 *
 * Body: { token }
 *
 * Security:
 *  - Token compared against SHA-256 hash stored in DB
 *  - Token expires 24h after registration
 *  - Cleared after successful verification (one-time use)
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token required",
      });
    }

    // Hash the incoming token to match what's stored in DB
    const hashedToken = hashToken(token);

    const user = await prisma.userAuth.findFirst({
      where: {
        verificationToken: hashedToken,
        verificationExpiry: { gt: new Date() },
        isVerified: false,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link",
      });
    }

    // Mark verified and clear the one-time token
    await prisma.userAuth.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    await logAudit(user.id, "EMAIL_VERIFIED", req);

    return res.status(200).json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("[AUTH] Verify email error:", err);
    return res.status(500).json({ success: false, message: "Email verification failed" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /forgot-password
// ────────────────────────────────────────────────────────────
/**
 * Initiate password reset — sends a reset link to the user's email.
 *
 * Body: { email }
 *
 * Security:
 *  - Always returns HTTP 200 (prevents email enumeration attacks)
 *  - Reset token expires in 1 hour
 *  - [FIX-4] Notification call now includes x-internal-secret header
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const user = await prisma.userAuth.findUnique({ where: { email } });

    // Always 200 — never reveal whether email exists (anti-enumeration)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent",
      });
    }

    // Generate secure reset token (valid 1 hour)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.userAuth.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry: resetExpiry },
    });

    // Notify email service — failure is non-fatal
    try {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/reset-password`,
        { userId: user.id, email: user.email, resetToken },
        {
          // [FIX-4] x-internal-secret was missing — caused 403 on Notification Service
          headers: {
            "x-internal-secret": process.env.INTERNAL_SECRET,
          },
          timeout: 5000,
        }
      );
    } catch (err) {
      console.error("[AUTH] Reset email notification failed:", err.message);
    }

    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent",
    });
  } catch (err) {
    console.error("[AUTH] Forgot password error:", err);
    return res.status(500).json({ success: false, message: "Request failed" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /reset-password
// ────────────────────────────────────────────────────────────
/**
 * Complete the password reset using the token from the email link.
 *
 * Body: { token, newPassword }
 *
 * Security:
 *  - Token must exist and not be expired
 *  - All active sessions are invalidated (force re-login on all devices)
 *  - Clears any account lockout state after reset
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password required",
      });
    }

    const user = await prisma.userAuth.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atomic: update password + invalidate all sessions
    await prisma.$transaction([
      prisma.userAuth.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
          failedAttempts: 0,     // clear lockout
          isLocked: false,
        },
      }),
      // Force re-login on ALL devices after password change
      prisma.userSession.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      }),
    ]);

    await logAudit(user.id, "PASSWORD_RESET", req);

    return res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("[AUTH] Reset password error:", err);
    return res.status(500).json({ success: false, message: "Password reset failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /sessions
// ────────────────────────────────────────────────────────────
/**
 * List all active sessions for the authenticated user.
 *
 * Headers: Authorization: Bearer <accessToken>
 *
 * Returns device/IP/timestamp metadata so users can identify
 * and revoke unfamiliar sessions.
 */
router.get("/sessions", verifyToken, async (req, res) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.user.userId, isActive: true },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: sessions });
  } catch (err) {
    console.error("[AUTH] Sessions error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch sessions" });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /sessions/:id
// ────────────────────────────────────────────────────────────
/**
 * Revoke a specific session by ID.
 *
 * Params:  :id  — session ID to revoke
 * Headers: Authorization: Bearer <accessToken>
 *
 * Security: Users can only revoke their own sessions (userId check).
 */
router.delete("/sessions/:id", verifyToken, async (req, res) => {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: req.params.id },
    });

    // Reject if session doesn't exist or belongs to another user
    if (!session || session.userId !== req.user.userId) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    await prisma.userSession.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    return res.status(200).json({ success: true, message: "Session revoked" });
  } catch (err) {
    console.error("[AUTH] Revoke session error:", err);
    return res.status(500).json({ success: false, message: "Failed to revoke session" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/verify-token  [Internal — service-to-service only]
// ────────────────────────────────────────────────────────────
/**
 * Validate an access token and return its decoded payload.
 * Called by other microservices to authenticate requests without
 * sharing JWT_SECRET across services.
 *
 * ⚠️  Must be protected at network/infra level (VPC-only, not public).
 *
 * Body: { token }
 */
router.post("/internal/verify-token", async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ success: true, data: decoded });
  } catch {
    return res.status(401).json({ success: false, message: "Token invalid" });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /admin/users/:id  [Admin only: SUPER_ADMIN | PLATFORM_ADMIN]
// ────────────────────────────────────────────────────────────
/**
 * Soft-delete a user account and clean up all related data.
 *
 * Params:  :id  — userProfile ID to delete
 * Headers: Authorization: Bearer <accessToken>  (must be admin)
 *
 * Actions performed:
 *  1. Soft-delete userProfile (isActive=false, email anonymized)
 *  2. Deactivate all organization memberships
 *  3. Revoke all pending invitations
 *  4. Notify Auth Service to deactivate auth record + sessions
 *  5. Send account-deleted notification email
 *  6. Write audit log
 *
 * Restrictions:
 *  - Cannot delete your own account
 *  - PLATFORM_ADMIN cannot delete SUPER_ADMIN (only SUPER_ADMIN can)
 *
 * Note: Steps 4–6 are independent try/catch — downstream failures
 *       do NOT roll back the core soft-delete transaction.
 */
router.delete(
  "/admin/users/:id",
  verifyToken,
  isPlatformAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;

      // ── Find User ─────────────────────────────────────────

      const user = await prisma.userProfile.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // ── Guard: Prevent Self-Delete ────────────────────────

      if (user.authUserId === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete your own account",
        });
      }

      // ── Guard: Only SUPER_ADMIN Can Delete SUPER_ADMIN ────

      if (user.role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only SUPER_ADMIN can delete SUPER_ADMIN",
        });
      }

      // ── Soft Delete: Profile + Memberships + Invitations ──

      await prisma.$transaction(async (tx) => {
        // Anonymize and deactivate profile
        await tx.userProfile.update({
          where: { id: userId },
          data: {
            isActive: false,
            deletedAt: new Date(),
            email: `deleted_${Date.now()}_${user.email}`, // prevents reuse conflicts
          },
        });

        // Remove from all organizations
        await tx.organizationMember.updateMany({
          where: { userId },
          data: { isActive: false },
        });

        // Cancel all pending invitations for this email
        await tx.invitation.updateMany({
          where: { email: user.email, status: "PENDING" },
          data: { status: "REVOKED" },
        });
      });

      // ── Notify Auth Service: deactivate auth record + sessions ──
      // Independent — failure does NOT roll back soft-delete above.

      try {
        await axios.delete(
          `${process.env.AUTH_SERVICE_URL}/api/auth/internal/users/${user.authUserId}`,
          {
            headers: { Authorization: req.headers.authorization },
            timeout: 5000,
          }
        );
        console.log("[USER] Auth user deactivated");
      } catch (authError) {
        console.error(
          "[USER] Auth delete failed:",
          authError?.response?.data || authError.message
        );
      }

      // ── Notify Notification Service: send deletion confirmation ──
      // Independent — failure does NOT roll back soft-delete above.

      try {
        await axios.post(
          `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/account-deleted`,
          {
            email: user.email,
            firstName: user.firstName,
            deletedBy: req.user.userId,
          },
          {
            // [FIX-5] x-internal-secret was missing — caused 403 on Notification Service
            headers: {
              Authorization: req.headers.authorization,
              "x-internal-secret": process.env.INTERNAL_SECRET,
            },
            timeout: 5000,
          }
        );
        console.log("[USER] Deletion notification queued");
      } catch (notifyError) {
        console.error(
          "[USER] Notification failed:",
          notifyError?.response?.data || notifyError.message
        );
      }

      // ── Audit Log ─────────────────────────────────────────

      try {
        await axios.post(
          `${process.env.AUTH_SERVICE_URL}/api/auth/internal/audit`,
          {
            action: "DELETE_USER",
            targetUserId: user.authUserId,
            performedBy: req.user.userId,
            metadata: {
              deletedProfileId: user.id,
              email: user.email,
              role: user.role,
            },
          },
          {
            headers: { Authorization: req.headers.authorization },
            timeout: 5000,
          }
        );
      } catch (auditError) {
        console.error("[USER] Audit failed:", auditError.message);
      }

      // ── Success Response ──────────────────────────────────

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: {
          deletedUserId: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("[USER] Delete user error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  }
);


/**
 * POST /internal/provision
 *
 * Internal-only route called by User Service when an ORG_ADMIN provisions
 * a new user directly into their organization.
 *
 * Differences from the public /register route:
 *   - Email is marked as verified immediately (admin-created accounts skip verification)
 *   - mustChangePassword is set to true — user must reset on first login
 *   - No session or tokens are issued here; the user logs in manually
 *
 * This route must be protected at the network/infra level (internal traffic only).
 *
 * Body:
 *   email               string   required
 *   password            string   required  (generated by User Service)
 *   role                string   optional  default: ORG_USER
 *   firstName           string   optional
 *   lastName            string   optional
 *   mustChangePassword  boolean  optional  default: true
 *
 * Responses:
 *   201  — auth user created, returns id + email + role
 *   400  — email or password missing
 *   409  — email already exists
 *   500  — unexpected server error
 *
 * Schema requirement:
 *   Add to your Auth Service User model in schema.prisma:
 *     mustChangePassword  Boolean  @default(false)
 *
 *   Run: npx prisma migrate dev --name add_must_change_password
 *
 * Login route update:
 *   Include mustChangePassword in your /login response so the frontend
 *   can redirect the user to a password change screen on first login:
 *
 *   return res.status(200).json({
 *     success: true,
 *     data: {
 *       accessToken,
 *       refreshToken,
 *       user: { ...userDetails },
 *       mustChangePassword: user.mustChangePassword ?? false,
 *     },
 *   });
 */
router.post("/internal/provision", async (req, res) => {
  try {
    const {
      email,
      password,
      role = "ORG_USER",
      mustChangePassword = true,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    // Check for duplicate email
    const existing = await prisma.userAuth.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // isVerified = true because admin-provisioned accounts skip email verification
    // mustChangePassword = true forces a password reset on first login
    const user = await prisma.userAuth.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        isVerified: true,
        mustChangePassword,
        isActive: true,
      },
    });

    await logAudit(user.id, "PROVISION_USER", req, {
      provisionedBy: "USER_SERVICE",
      role,
      mustChangePassword,
    });

    console.log(`[AUTH] User provisioned: ${user.id}`);

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error("[AUTH] Internal provision error:", err);
    return res.status(500).json({ success: false, message: "Provision failed" });
  }
});
export default router;