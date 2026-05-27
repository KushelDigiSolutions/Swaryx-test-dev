/**
 * =========================================================
 * 💳 SUBSCRIPTION SERVICE — routes.js  [FIXED]
 * =========================================================
 * Public Routes:
 *  GET    /plans                         → List all plans
 *  GET    /plans/:tier                   → Single plan details
 *
 * Subscription Routes:
 *  GET    /subscriptions/mine            → My org subscription
 *  POST   /subscriptions/upgrade         → Upgrade plan
 *  POST   /subscriptions/cancel          → Cancel subscription
 *  POST   /subscriptions/resume          → Resume cancelled
 *  PATCH  /subscriptions/billing-cycle   → Switch monthly/yearly
 *
 * Invoice Routes:
 *  GET    /invoices                      → My invoices (paginated)
 *  GET    /invoices/:id                  → Single invoice
 *
 * Usage Routes:
 *  GET    /usage/current                 → Current period usage
 *  POST   /usage/track                   → Record usage event (internal)
 *
 * Admin Routes:
 *  GET    /admin/subscriptions           → All subscriptions
 *  PATCH  /admin/subscriptions/:id/plan  → Force plan change
 *  GET    /admin/revenue                 → Revenue summary
 *
 * Internal Routes:
 *  POST   /internal/initialize           → Called by User Service on org create
 *  POST   /internal/usage                → Called by other services to log usage
 *  GET    /internal/:organizationId      → Check plan & limits
 *
 * Bug Fixes Applied:
 *  [FIX-1] POST /subscriptions/upgrade — added notification (email + in-app)
 *          for plan upgrade with x-internal-secret header
 *  [FIX-2] POST /subscriptions/cancel — added cancellation notification
 *          (email + in-app) with x-internal-secret header
 *  [FIX-3] POST /subscriptions/resume — added resume notification
 *  [FIX-4] PATCH /admin/subscriptions/:id/plan — added admin force-change
 *          notification to affected org's users
 *  [FIX-5] Added axios import (was missing — needed for notification calls)
 * =========================================================
 */

import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios"; // [FIX-5] was missing
import prisma from "../../utils/prisma.js";

const router = express.Router();

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token required" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    console.log(req.user)
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

const isPlatformAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN");
const isOrgAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN");

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const getPeriodDates = (cycle) => {
  const now = new Date();
  const end = new Date(now);
  if (cycle === "YEARLY") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return { start: now, end };
};

const generateInvoiceNumber = () => {
  const prefix = "INV";
  const date = new Date().toISOString().slice(0, 7).replace("-", "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${date}-${rand}`;
};

/**
 * internalHeaders
 * ---------------
 * Returns headers required for all internal service-to-service calls.
 * Notification Service's validateInternalSecret middleware checks
 * the x-internal-secret header — without it every call returns 403.
 */
const internalHeaders = (authHeader) => ({
  Authorization: authHeader,
  "x-internal-secret": process.env.INTERNAL_SECRET,
});

/**
 * notifySubscription
 * ------------------
 * Fire-and-forget helper to send both an email and in-app notification
 * via the Notification Service.
 * Failures are logged but never block the main request.
 *
 * @param {object} opts
 * @param {string} opts.authHeader   - Forwarded Authorization header
 * @param {string} opts.userId       - authUserId of the recipient
 * @param {string} opts.email        - Recipient email address
 * @param {string} opts.inAppTitle   - In-app notification title
 * @param {string} opts.inAppBody    - In-app notification body
 * @param {string} opts.emailSubject - Email subject line
 * @param {string} opts.emailHtml    - Email HTML body
 * @param {string} [opts.priority]   - "NORMAL" | "HIGH" (default: "NORMAL")
 */
const notifySubscription = async ({
  authHeader,
  userId,
  email,
  inAppTitle,
  inAppBody,
  emailSubject,
  emailHtml,
  priority = "NORMAL",
}) => {
  const headers = internalHeaders(authHeader);
  const base = `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`;

  try {
    // In-app notification
    await axios.post(
      base,
      { userId, title: inAppTitle, body: inAppBody, type: "IN_APP", priority },
      { headers, timeout: 5000 }
    );

    // Email notification
    await axios.post(
      base,
      {
        userId,
        title: emailSubject,
        body: inAppBody,
        type: "EMAIL",
        toEmail: email,
        subject: emailSubject,
        htmlBody: emailHtml,
      },
      { headers, timeout: 5000 }
    );

    console.log("[SUB] Notification sent ✅ →", inAppTitle);
  } catch (err) {
    console.error("[SUB] Notification failed:", err?.response?.data || err.message);
  }
};

// ─────────────────────────────────────────────
// PLAN ROUTES
// ─────────────────────────────────────────────

// GET /plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { monthlyPrice: "asc" },
    });
    return res.status(200).json({ success: true, data: plans });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch plans" });
  }
});

// GET /plans/:tier
router.get("/plans/:tier", async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { tier: req.params.tier.toUpperCase() } });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch plan" });
  }
});

// ─────────────────────────────────────────────
// SUBSCRIPTION ROUTES
// ─────────────────────────────────────────────
const validateOrganization = (req, res) => {
  if (!req.user?.organizationId) {
    res.status(400).json({
      success: false,
      message: "Organization ID missing in token",
    });

    return false;
  }

  return true;
};


// GET /subscriptions/mine
router.get("/subscriptions/mine", verifyToken, async (req, res) => {
  try {

    if (!validateOrganization(req, res)) return;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
      include: { plan: true },
    });

    return res.status(200).json({
      success: true,
      data: subscription,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
    });
  }
});

// POST /subscriptions/upgrade
// [FIX-1] Added notification after successful upgrade
router.post("/subscriptions/upgrade", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const { planTier, billingCycle } = req.body;
    console.log("USER => ", req.user);

    const plan = await prisma.plan.findUnique({ where: { tier: planTier } });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: "No subscription to upgrade" });
    }

    const cycle = billingCycle || subscription.billingCycle;
    const period = getPeriodDates(cycle);
    const price = cycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;

    // Update subscription + create invoice in transaction
    const [updated] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          billingCycle: cycle,
          status: "ACTIVE",
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      }),
      prisma.invoice.create({
        data: {
          subscriptionId: subscription.id,
          invoiceNumber: generateInvoiceNumber(),
          status: "OPEN",
          amount: price,
          tax: +(Number(price) * 0.18).toFixed(2), // 18% GST
          total: +(Number(price) * 1.18).toFixed(2),
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // [FIX-1] Send upgrade notification — email + in-app
    notifySubscription({
      authHeader: req.headers.authorization,
      userId: req.user.userId,
      email: req.user.email,
      inAppTitle: `Plan upgraded to ${plan.tier}`,
      inAppBody: `Your subscription has been upgraded to the ${plan.tier} plan (${cycle}).`,
      emailSubject: `Subscription Upgraded to ${plan.tier}`,
      emailHtml: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Plan Upgraded 🚀</h2>
          <p>Your subscription has been successfully upgraded.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">New Plan</td>
                <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">${plan.tier}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">Billing Cycle</td>
                <td style="padding:8px;border:1px solid #e5e7eb">${cycle}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">Amount</td>
                <td style="padding:8px;border:1px solid #e5e7eb">₹${+(Number(price) * 1.18).toFixed(2)} (incl. GST)</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">Next Renewal</td>
                <td style="padding:8px;border:1px solid #e5e7eb">${period.end.toDateString()}</td></tr>
          </table>
          <p style="color:#666;font-size:13px">Thank you for upgrading. An invoice has been generated.</p>
        </div>
      `,
      priority: "HIGH",
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[SUB] Upgrade error:", err);
    return res.status(500).json({ success: false, message: "Failed to upgrade subscription" });
  }
});

// POST /subscriptions/cancel
// [FIX-2] Added cancellation notification — email + in-app
router.post("/subscriptions/cancel", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const { immediately = false } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: "No subscription found" });
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: !immediately,
        status: immediately ? "CANCELLED" : subscription.status,
        cancelledAt: immediately ? new Date() : null,
      },
    });

    const message = immediately
      ? "Subscription cancelled immediately"
      : "Subscription will cancel at period end";

    // [FIX-2] Send cancellation notification
    const cancelNote = immediately
      ? "Your subscription has been cancelled immediately."
      : `Your subscription will remain active until ${subscription.currentPeriodEnd?.toDateString()} and will not renew.`;

    notifySubscription({
      authHeader: req.headers.authorization,
      userId: req.user.userId,
      email: req.user.email,
      inAppTitle: "Subscription Cancelled",
      inAppBody: cancelNote,
      emailSubject: "Your Subscription Has Been Cancelled",
      emailHtml: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Subscription Cancelled</h2>
          <p>${cancelNote}</p>
          ${!immediately ? `<p>You will continue to have access to <strong>${subscription.plan?.tier || "your current"}</strong> plan features until the end of your billing period.</p>` : ""}
          <p>If this was a mistake, you can reactivate your subscription from your dashboard.</p>
          <p style="color:#666;font-size:13px">We're sorry to see you go. — SaaS Platform Team</p>
        </div>
      `,
      priority: "HIGH",
    });

    return res.status(200).json({ success: true, message, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to cancel subscription" });
  }
});

// POST /subscriptions/resume
// [FIX-3] Added resume notification
router.post("/subscriptions/resume", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
      include: { plan: true },
    });

    if (!subscription || subscription.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Subscription cannot be resumed" });
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false, cancelledAt: null, status: "ACTIVE" },
    });

    // [FIX-3] Send resume notification
    notifySubscription({
      authHeader: req.headers.authorization,
      userId: req.user.userId,
      email: req.user.email,
      inAppTitle: "Subscription Resumed",
      inAppBody: "Your subscription has been resumed and will renew as scheduled.",
      emailSubject: "Your Subscription Has Been Resumed",
      emailHtml: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Subscription Resumed ✅</h2>
          <p>Great news! Your subscription has been successfully resumed.</p>
          <p>Your <strong>${subscription.plan?.tier || "current"}</strong> plan will continue and renew on <strong>${subscription.currentPeriodEnd?.toDateString()}</strong>.</p>
          <p style="color:#666;font-size:13px">Welcome back! — SaaS Platform Team</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to resume subscription" });
  }
});

// PATCH /subscriptions/billing-cycle
router.patch("/subscriptions/billing-cycle", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const { billingCycle } = req.body;

    if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
      return res.status(400).json({ success: false, message: "Invalid billing cycle" });
    }

    const updated = await prisma.subscription.update({
      where: { organizationId: req.user.organizationId },
      data: { billingCycle },
    });

    // Notify billing cycle change
    notifySubscription({
      authHeader: req.headers.authorization,
      userId: req.user.userId,
      email: req.user.email,
      inAppTitle: "Billing Cycle Updated",
      inAppBody: `Your billing cycle has been changed to ${billingCycle}.`,
      emailSubject: "Billing Cycle Changed",
      emailHtml: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Billing Cycle Updated</h2>
          <p>Your billing cycle has been changed to <strong>${billingCycle}</strong>.</p>
          <p>This change will take effect from your next renewal date.</p>
          <p style="color:#666;font-size:13px">— SaaS Platform Team</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update billing cycle" });
  }
});

// ─────────────────────────────────────────────
// INVOICE ROUTES
// ─────────────────────────────────────────────

// GET /invoices
router.get("/invoices", verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });

    if (!subscription) return res.status(404).json({ success: false, message: "No subscription" });

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { subscriptionId: subscription.id },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where: { subscriptionId: subscription.id } }),
    ]);

    return res.status(200).json({
      success: true,
      data: invoices,
      meta: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
});

// GET /invoices/:id
router.get("/invoices/:id", verifyToken, async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { subscription: true },
    });

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    return res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch invoice" });
  }
});

// ─────────────────────────────────────────────
// USAGE ROUTES
// ─────────────────────────────────────────────

// GET /usage/current
router.get("/usage/current", verifyToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
      include: { plan: true },
    });

    if (!subscription) return res.status(404).json({ success: false, message: "No subscription" });

    const usage = await prisma.usageLog.groupBy({
      by: ["metric"],
      where: {
        subscriptionId: subscription.id,
        recordedAt: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      _sum: { quantity: true },
    });

    const limits = {
      api_calls: subscription.plan.maxApiCallsMonth,
      storage: subscription.plan.maxStorageGb,
      seats: subscription.plan.maxUsers,
    };

    return res.status(200).json({ success: true, data: { usage, limits } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch usage" });
  }
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// GET /admin/subscriptions
router.get("/admin/subscriptions", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const where = { ...(status && { status }) };

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: subs,
      meta: { total, page: Number(page) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
  }
});

// GET /admin/revenue
router.get("/admin/revenue", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const summary = await prisma.invoice.groupBy({
      by: ["status"],
      _sum: { total: true },
      _count: { id: true },
    });

    const mrr = await prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { total: true },
    });

    return res.status(200).json({ success: true, data: { summary, totalRevenue: mrr._sum.total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch revenue" });
  }
});

// PATCH /admin/subscriptions/:id/plan
// [FIX-4] Added notification when admin force-changes a plan
router.patch("/admin/subscriptions/:id/plan", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { planTier } = req.body;
    const plan = await prisma.plan.findUnique({ where: { tier: planTier } });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    // Fetch subscription with org details for notification
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: { planId: plan.id, status: "ACTIVE" },
    });

    // [FIX-4] Notify org members via generic send if we can find a user to notify
    // (admin action — best effort, no hard dependency)
    try {
      if (subscription?.organizationId) {
        // Find ORG_ADMIN of the affected org to notify
        const orgAdmin = await prisma.userProfile.findFirst({
          where: { organizationId: subscription.organizationId, role: "ORG_ADMIN", isActive: true },
        });

        if (orgAdmin) {
          await axios.post(
            `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
            {
              userId: orgAdmin.authUserId,
              title: "Your Plan Has Been Updated",
              body: `An administrator has changed your subscription plan to ${plan.tier}.`,
              type: "IN_APP",
              priority: "HIGH",
            },
            { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
          );

          await axios.post(
            `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
            {
              userId: orgAdmin.authUserId,
              title: "Subscription Plan Updated by Admin",
              body: `Your plan has been changed to ${plan.tier}.`,
              type: "EMAIL",
              toEmail: orgAdmin.email,
              subject: `Your Subscription Plan Has Been Updated to ${plan.tier}`,
              htmlBody: `
                <div style="font-family:sans-serif;max-width:600px;margin:auto">
                  <h2>Plan Updated by Administrator</h2>
                  <p>Hi ${orgAdmin.firstName || "there"},</p>
                  <p>An administrator has updated your organization's subscription plan.</p>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">Previous Plan</td>
                        <td style="padding:8px;border:1px solid #e5e7eb">${subscription.plan?.tier || "N/A"}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#666">New Plan</td>
                        <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">${plan.tier}</td></tr>
                  </table>
                  <p style="color:#666;font-size:13px">If you have questions, please contact support.</p>
                </div>
              `,
            },
            { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
          );
          console.log("[SUB] Admin plan-change notification sent ✅");
        }
      }
    } catch (notifyErr) {
      console.error("[SUB] Admin plan-change notification failed:", notifyErr?.response?.data || notifyErr.message);
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to change plan" });
  }
});

// ─────────────────────────────────────────────
// INTERNAL ROUTES
// ─────────────────────────────────────────────

// POST /internal/initialize — Called by User Service when org is created
router.post("/internal/initialize", async (req, res) => {
  try {
    const { organizationId, plan: planTier = "FREE" } = req.body;

    // Idempotent
    const existing = await prisma.subscription.findUnique({ where: { organizationId } });
    if (existing) return res.status(200).json({ success: true, data: existing });

    const plan = await prisma.plan.findUnique({ where: { tier: planTier } });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const period = getPeriodDates("MONTHLY");
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: "TRIALING",
        trialEndsAt: trialEnd,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    });

    return res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    console.error("[SUB] Initialize error:", err);
    return res.status(500).json({ success: false, message: "Failed to initialize subscription" });
  }
});

// POST /internal/usage — Called by other services to track usage
router.post("/internal/usage", async (req, res) => {
  try {
    const { organizationId, metric, quantity = 1, metadata } = req.body;

    const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription) return res.status(404).json({ success: false, message: "Subscription not found" });

    await prisma.usageLog.create({
      data: { subscriptionId: subscription.id, metric, quantity, metadata },
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to log usage" });
  }
});

// GET /internal/:organizationId — Check plan & limits
router.get("/internal/:organizationId", async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: req.params.organizationId },
      include: { plan: true },
    });

    if (!subscription) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({
      success: true,
      data: {
        status: subscription.status,
        tier: subscription.plan.tier,
        features: subscription.plan.features,
        limits: {
          maxUsers: subscription.plan.maxUsers,
          maxProjects: subscription.plan.maxProjects,
          maxStorageGb: subscription.plan.maxStorageGb,
          maxApiCallsMonth: subscription.plan.maxApiCallsMonth,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

export default router;