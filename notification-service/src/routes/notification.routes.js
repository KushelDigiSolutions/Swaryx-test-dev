/**
 * ============================================================
 * 🔔 NOTIFICATION SERVICE — routes.js
 * ============================================================
 *
 * In-App Routes:
 *  GET    /notifications              → My notifications (paginated)
 *  PATCH  /notifications/:id/read     → Mark one as read
 *  PATCH  /notifications/read-all     → Mark all as read
 *  DELETE /notifications/:id          → Delete notification
 *
 * Preference Routes:
 *  GET    /preferences                → Get my preferences
 *  PATCH  /preferences                → Update preferences
 *
 * Admin Routes:
 *  GET    /admin/templates            → List templates
 *  POST   /admin/templates            → Create template
 *  PATCH  /admin/templates/:id        → Update template
 *  POST   /admin/broadcast            → Send to all / role
 *
 * Internal Routes (service-to-service, validated by x-internal-secret):
 *  POST   /internal/welcome           → Welcome email on register
 *  POST   /internal/reset-password    → Password reset email
 *  POST   /internal/invite            → Org invite email
 *  POST   /internal/account-deleted   → Account deletion email
 *  POST   /internal/send              → Generic send
 *
 * Bug Fixes Applied:
 *  [FIX-1] mailer auth.user was set to EMAIL_PASS (wrong variable)
 *          Now correctly uses SMTP_USER for username, SMTP_PASS for password
 *  [FIX-2] Added missing /internal/account-deleted route
 *          (Auth service calls this on admin user delete — was 404 before)
 *  [FIX-3] /internal/welcome now uses verificationToken from body
 *          to build the actual email verification link
 * ============================================================
 */

import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import prisma from "../../utils/prisma.js";

const router = express.Router();

// ============================================================
// ⚙️  EMAIL TRANSPORT
// ============================================================

/**
 * Nodemailer SMTP transporter.
 *
 * [FIX-1] auth.user was incorrectly set to process.env.EMAIL_PASS
 *         (same wrong variable for both user and pass).
 *         Now uses SMTP_USER (email address) and SMTP_PASS (app password).
 *
 * Gmail settings in .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx   ← 16-char Gmail App Password
 */
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === "true", // true = SSL/TLS (port 465)
  auth: {
    user: process.env.SMTP_USER,  // [FIX-1] was EMAIL_PASS (wrong) → now SMTP_USER
    pass: process.env.SMTP_PASS,  // [FIX-1] was EMAIL_PASS (wrong) → now SMTP_PASS
  },
});

// ============================================================
// 📧  EMAIL HELPERS
// ============================================================

/**
 * sendEmail
 * ---------
 * Sends an email via the configured SMTP transporter.
 * Returns { success, messageId } on success or { success: false, error } on failure.
 * Never throws — callers check the returned object.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await mailer.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "SaaS Platform"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    console.log("[NOTIFY] Email sent ✅ →", to, "| messageId:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[NOTIFY] Email send failed:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * fillTemplate
 * ------------
 * Replaces {{key}} placeholders in a template string with actual values.
 * Example: fillTemplate("Hello {{name}}", { name: "Ali" }) → "Hello Ali"
 */
const fillTemplate = (template, vars) => {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replaceAll(`{{${key}}}`, value ?? "");
  });
  return result;
};

// ============================================================
// 🛡️  MIDDLEWARE
// ============================================================

/**
 * verifyToken
 * -----------
 * Validates the Bearer JWT from Authorization header.
 * Attaches decoded payload to req.user.
 */
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * requireRoles(...roles)
 * ----------------------
 * Role-based access control — use after verifyToken.
 */
const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

/**
 * isPlatformAdmin
 * ---------------
 * Shorthand: SUPER_ADMIN or PLATFORM_ADMIN only.
 */
const isPlatformAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN");

/**
 * validateInternalSecret
 * ----------------------
 * Protects internal routes from outside access.
 * Caller must send: x-internal-secret: <INTERNAL_SECRET from .env>
 *
 * Auth Service sends this via the internalHeaders() helper.
 * Both services must share the SAME INTERNAL_SECRET value in their .env files.
 */
const validateInternalSecret = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    console.warn("[NOTIFY] Rejected internal call — invalid x-internal-secret");
    return res.status(403).json({ success: false, message: "Unauthorized internal call" });
  }
  next();
};

// ============================================================
// ============================================================
// 📌  ROUTES
// ============================================================
// ============================================================

// ────────────────────────────────────────────────────────────
// GET /notifications
// ────────────────────────────────────────────────────────────
/**
 * Fetch paginated in-app notifications for the current user.
 *
 * Query: { page?, limit?, unreadOnly? }
 * Returns: { data, meta: { total, unreadCount, page, pages } }
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      userId: req.user.userId,
      type: "IN_APP",
      ...(unreadOnly === "true" && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user.userId, isRead: false, type: "IN_APP" },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      meta: {
        total,
        unreadCount,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("[NOTIFY] Fetch notifications error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /notifications/:id/read
// ────────────────────────────────────────────────────────────
/**
 * Mark a single notification as read.
 * Users can only mark their own notifications.
 */
router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user.userId) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true, readAt: new Date(), status: "READ" },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[NOTIFY] Mark read error:", err);
    return res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /notifications/read-all
// ────────────────────────────────────────────────────────────
/**
 * Mark ALL unread in-app notifications as read for the current user.
 */
router.patch("/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true, readAt: new Date(), status: "READ" },
    });

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("[NOTIFY] Read-all error:", err);
    return res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /notifications/:id
// ────────────────────────────────────────────────────────────
/**
 * Delete a single notification.
 * Users can only delete their own notifications.
 */
router.delete("/notifications/:id", verifyToken, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user.userId) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    await prisma.notification.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("[NOTIFY] Delete notification error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /preferences
// ────────────────────────────────────────────────────────────
/**
 * Get notification preferences for the current user.
 * Auto-creates default preferences if none exist yet.
 */
router.get("/preferences", verifyToken, async (req, res) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: req.user.userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.user.userId },
      });
    }

    return res.status(200).json({ success: true, data: prefs });
  } catch (err) {
    console.error("[NOTIFY] Fetch preferences error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch preferences" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /preferences
// ────────────────────────────────────────────────────────────
/**
 * Update notification preferences (partial update supported).
 * Uses upsert — creates defaults if record doesn't exist yet.
 */
router.patch("/preferences", verifyToken, async (req, res) => {
  try {
    const { emailEnabled, smsEnabled, pushEnabled, inAppEnabled, categoryPrefs } = req.body;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        emailEnabled,
        smsEnabled,
        pushEnabled,
        inAppEnabled,
        categoryPrefs,
      },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(inAppEnabled !== undefined && { inAppEnabled }),
        ...(categoryPrefs !== undefined && { categoryPrefs }),
      },
    });

    return res.status(200).json({ success: true, data: prefs });
  } catch (err) {
    console.error("[NOTIFY] Update preferences error:", err);
    return res.status(500).json({ success: false, message: "Failed to update preferences" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /admin/templates
// ────────────────────────────────────────────────────────────
/**
 * List all notification templates. Admin only.
 */
router.get("/admin/templates", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ success: true, data: templates });
  } catch (err) {
    console.error("[NOTIFY] Fetch templates error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch templates" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /admin/templates
// ────────────────────────────────────────────────────────────
/**
 * Create a new notification template. Admin only.
 *
 * Body: { name, type, subject, body, htmlBody }
 */
router.post("/admin/templates", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { name, type, subject, body, htmlBody } = req.body;

    const template = await prisma.notificationTemplate.create({
      data: { name, type, subject, body, htmlBody },
    });

    return res.status(201).json({ success: true, data: template });
  } catch (err) {
    console.error("[NOTIFY] Create template error:", err);
    return res.status(500).json({ success: false, message: "Failed to create template" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /admin/templates/:id
// ────────────────────────────────────────────────────────────
/**
 * Update an existing notification template. Admin only.
 * Partial update — only provided fields are changed.
 */
router.patch("/admin/templates/:id", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { subject, body, htmlBody, isActive } = req.body;

    const updated = await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
        ...(htmlBody !== undefined && { htmlBody }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[NOTIFY] Update template error:", err);
    return res.status(500).json({ success: false, message: "Failed to update template" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /admin/broadcast
// ────────────────────────────────────────────────────────────
/**
 * Broadcast a notification to all users or a subset by role.
 * Admin only.
 *
 * Body: { title, body, link, targetRoles?, targetUserIds? }
 *
 * Note: In production, push this to a job queue (Bull/Redis/SQS)
 *       rather than processing synchronously.
 */
router.post("/admin/broadcast", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { title, body, link, targetRoles, targetUserIds } = req.body;

    // TODO: Push to Bull/Redis queue for async processing at scale
    return res.status(200).json({
      success: true,
      message: "Broadcast queued (connect to job queue in production)",
      data: { title, body, targetRoles, targetUserIds },
    });
  } catch (err) {
    console.error("[NOTIFY] Broadcast error:", err);
    return res.status(500).json({ success: false, message: "Broadcast failed" });
  }
});

// ============================================================
// ============================================================
// 🔒  INTERNAL ROUTES — Service-to-service only
//     Protected by validateInternalSecret middleware
//     Caller must send: x-internal-secret: <INTERNAL_SECRET>
// ============================================================
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /internal/welcome
// ────────────────────────────────────────────────────────────
/**
 * Send welcome email + create in-app notification after registration.
 * Called by Auth Service after new user registers.
 *
 * Body: { userId, email, role, firstName, verificationToken }
 *
 * [FIX-3] verificationToken from body is now used to build the
 *         actual clickable verification link in the email.
 *         Previously the link was missing/not built at all.
 */
router.post("/internal/welcome", validateInternalSecret, async (req, res) => {
  try {
    const { userId, email, role, firstName, verificationToken } = req.body;

    // [FIX-3] Build the real email verification link using the token
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Try to load a custom template from DB; fall back to default HTML
    const template = await prisma.notificationTemplate.findFirst({
      where: { type: "WELCOME", isActive: true },
    });

    const subject = template?.subject || "Welcome — please verify your email";

    const htmlBody = template?.htmlBody
      ? fillTemplate(template.htmlBody, { email, role, firstName, verifyLink })
      : `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Welcome${firstName ? ", " + firstName : ""}! 👋</h2>
          <p>Your account has been created with email: <strong>${email}</strong></p>
          <p>Please verify your email address to activate your account:</p>
          <a href="${verifyLink}"
             style="display:inline-block;background:#4f46e5;color:#fff;
                    padding:12px 28px;border-radius:6px;text-decoration:none;
                    font-weight:600;margin:16px 0">
            Verify Email
          </a>
          <p style="color:#666;font-size:13px">
            This link expires in 24 hours. If you did not create this account, ignore this email.
          </p>
        </div>
      `;

    // ── Create in-app notification ──────────────────────────

    await prisma.notification.create({
      data: {
        userId,
        title: "Welcome! Please verify your email",
        body: "Click the link in your email to verify your account.",
        type: "IN_APP",
        status: "SENT",
        link: "/verify-email",
      },
    });

    // ── Send welcome email ──────────────────────────────────

    const emailResult = await sendEmail({ to: email, subject, html: htmlBody });

    // Record the email notification in DB
    await prisma.notification.create({
      data: {
        userId,
        title: subject,
        body: "Welcome email sent",
        type: "EMAIL",
        status: emailResult.success ? "SENT" : "FAILED",
        toEmail: email,
        sentAt: new Date(),
        ...(emailResult.error && { failReason: emailResult.error }),
      },
    });

    return res.status(201).json({ success: true, message: "Welcome notification sent" });
  } catch (err) {
    console.error("[NOTIFY] Welcome error:", err);
    return res.status(500).json({ success: false, message: "Failed to send welcome notification" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/reset-password
// ────────────────────────────────────────────────────────────
/**
 * Send password reset email.
 * Called by Auth Service on POST /forgot-password.
 *
 * Body: { userId, email, resetToken }
 */
router.post("/internal/reset-password", validateInternalSecret, async (req, res) => {
  try {
    const { userId, email, resetToken } = req.body;

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = "Reset Your Password";
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;background:#4f46e5;color:#fff;
                  padding:12px 28px;border-radius:6px;text-decoration:none;
                  font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `;

    const emailResult = await sendEmail({ to: email, subject, html: htmlBody });

    await prisma.notification.create({
      data: {
        userId,
        title: subject,
        body: "Password reset email sent",
        type: "EMAIL",
        status: emailResult.success ? "SENT" : "FAILED",
        toEmail: email,
        sentAt: new Date(),
        ...(emailResult.error && { failReason: emailResult.error }),
      },
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("[NOTIFY] Reset password error:", err);
    return res.status(500).json({ success: false, message: "Failed to send reset email" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/invite
// ────────────────────────────────────────────────────────────
/**
 * Send organization invitation email.
 * Called by User/Org Service when a user is invited.
 *
 * Body: { email, inviteToken, organizationId, organizationName? }
 */
router.post("/internal/invite", validateInternalSecret, async (req, res) => {
  try {
    const { email, inviteToken, organizationId, organizationName } = req.body;

    // const inviteLink = `${process.env.FRONTEND_URL}/invite?token=${inviteToken}`;
    const inviteLink = `${process.env.FRONTEND_URL}/invite?token=${inviteToken}`;


    const orgLabel = organizationName || "an organization";
    const subject = `You've been invited to join ${orgLabel}`;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>You're invited! 🎉</h2>
        <p>You've been invited to join <strong>${orgLabel}</strong> on our platform.</p>
        <a href="${inviteLink}"
           style="display:inline-block;background:#4f46e5;color:#fff;
                  padding:12px 28px;border-radius:6px;text-decoration:none;
                  font-weight:600;margin:16px 0">
          Accept Invitation
        </a>
        <p style="color:#666;font-size:13px">This invite expires in 7 days.</p>
      </div>
    `;

    const emailResult = await sendEmail({ to: email, subject, html: htmlBody });

    return res.status(201).json({ success: true, emailSent: emailResult.success });
  } catch (err) {
    console.error("[NOTIFY] Invite error:", err);
    return res.status(500).json({ success: false, message: "Failed to send invite email" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/account-deleted
// ────────────────────────────────────────────────────────────
/**
 * Send account deletion confirmation email.
 * Called by Auth/User Service on DELETE /admin/users/:id.
 *
 * [FIX-2] This route was completely missing — Auth Service was calling
 *         it but getting 404. Added the full implementation.
 *
 * Body: { email, firstName, deletedBy }
 */
router.post("/internal/account-deleted", validateInternalSecret, async (req, res) => {
  try {
    const { email, firstName, deletedBy } = req.body;

    const subject = "Your account has been removed";
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Account Removed</h2>
        <p>Hi${firstName ? " " + firstName : ""},</p>
        <p>
          Your account associated with <strong>${email}</strong> has been removed
          from the platform by an administrator.
        </p>
        <p style="color:#666;font-size:13px">
          If you believe this was a mistake, please contact support.
        </p>
      </div>
    `;

    const emailResult = await sendEmail({ to: email, subject, html: htmlBody });

    return res.status(201).json({ success: true, emailSent: emailResult.success });
  } catch (err) {
    console.error("[NOTIFY] Account-deleted error:", err);
    return res.status(500).json({ success: false, message: "Failed to send deletion email" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/send  — Generic send for any service
// ────────────────────────────────────────────────────────────
/**
 * Generic notification sender — any service can call this to send
 * an email or in-app notification without a dedicated route.
 *
 * Body: {
 *   userId, title, body,
 *   type?      — "IN_APP" | "EMAIL" (default: "IN_APP")
 *   toEmail?   — required when type = "EMAIL"
 *   subject?   — email subject
 *   htmlBody?  — email HTML content
 *   link?      — in-app notification link
 *   priority?  — "NORMAL" | "HIGH" (default: "NORMAL")
 * }
 */
router.post("/internal/send", validateInternalSecret, async (req, res) => {
  try {
    const {
      userId,
      title,
      body,
      type = "IN_APP",
      toEmail,
      subject,
      htmlBody,
      link,
      priority,
    } = req.body;

    // Create notification record (initially QUEUED)
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
        status: "QUEUED",
        priority: priority || "NORMAL",
        link,
        toEmail,
        subject,
        htmlBody,
      },
    });

    // Process immediately based on type
    if (type === "EMAIL" && toEmail) {
      const result = await sendEmail({ to: toEmail, subject, html: htmlBody });
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: result.success ? "SENT" : "FAILED",
          sentAt: result.success ? new Date() : undefined,
          failReason: result.error,
        },
      });
    } else if (type === "IN_APP") {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    return res.status(201).json({
      success: true,
      data: { notificationId: notification.id },
    });
  } catch (err) {
    console.error("[NOTIFY] Generic send error:", err);
    return res.status(500).json({ success: false, message: "Failed to send notification" });
  }
});

export default router;