/**
 * =========================================================
 * 👤 USER SERVICE — routes.js  [FIXED + NEW FEATURES]
 * =========================================================
 * Profile Routes:
 *  GET    /profile/me            → My profile
 *  PATCH  /profile/me            → Update my profile
 *  GET    /profile/:userId       → Get any profile (admin)
 *
 * Organization Routes:
 *  POST   /organizations                      → Create org (ORG_ADMIN)
 *  GET    /organizations/mine                 → My org
 *  PATCH  /organizations/:id                  → Update org
 *  GET    /organizations/:id/members          → List members
 *  DELETE /organizations/:id/members/:userId  → Remove member
 *
 *  ★ NEW: POST /organizations/:id/members/add       → Direct add existing user
 *  ★ NEW: POST /organizations/:id/members/bulk-invite → Bulk invite (multiple emails)
 *
 * Invitation Routes:
 *  POST   /invitations                → Send invite (single)
 *  GET    /invitations/:token         → Get invite details
 *  POST   /invitations/:token/accept  → Accept invite
 *  DELETE /invitations/:id            → Revoke invite
 *
 * Admin Routes (SUPER_ADMIN / PLATFORM_ADMIN):
 *  GET    /admin/users                → List all users
 *  GET    /admin/organizations        → List all orgs
 *  PATCH  /admin/users/:id/role       → Change user role
 *  DELETE /admin/users/:id            → Soft delete user
 *
 * Internal Routes (service-to-service):
 *  POST   /internal/create            → Called by Auth on register
 *  GET    /internal/:authUserId       → Called by other services
 *
 * Bug Fixes Applied:
 *  [FIX-1] POST /invitations — added "x-internal-secret" header on
 *          notification call (was 403 before)
 *  [FIX-2] POST /organizations — added "x-internal-secret" on subscription
 *          init call, added org-created notification (email + in-app)
 *  [FIX-3] DELETE /admin/users/:id — added full notification flow
 *          (account-deleted email + in-app) with x-internal-secret
 *  [FIX-4] POST /invitations/:token/accept — added welcome-to-org
 *          in-app notification via /internal/send
 *
 * New Features:
 *  [NEW-1] POST /organizations/:id/members/add
 *          ORG_ADMIN directly add kare kisi registered user ko by email.
 *          User ko email + in-app dono notification milti hai.
 *          Guards: same-org check, already-member check, self-add block.
 *
 *  [NEW-2] POST /organizations/:id/members/bulk-invite
 *          Ek saath multiple emails ko invite bhejo (max 50).
 *          Har email ke liye individual invite record + notification.
 *          Response mein success/skipped/failed breakdown milta hai.
 * =========================================================
 */

import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import prisma from "../../utils/prisma.js";

const router = express.Router();

// ─────────────────────────────────────────────
// MIDDLEWARE — Verify JWT
// ─────────────────────────────────────────────

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token required" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    console.log("[USER] Token verification failed");
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// ─────────────────────────────────────────────
// MIDDLEWARE — Role Guards
// ─────────────────────────────────────────────

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

const isPlatformAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN");
const isOrgAdmin = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN");
const isOrgManager = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER");

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const generateSlug = (name) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

/**
 * internalHeaders
 * ---------------
 * Returns headers required for service-to-service calls.
 * Every internal route on Notification Service is protected by
 * validateInternalSecret — this helper ensures the header is never forgotten.
 */
const internalHeaders = (authHeader) => ({
  Authorization: authHeader,
  "x-internal-secret": process.env.INTERNAL_SECRET,
});

// ─────────────────────────────────────────────
// PROFILE ROUTES
// ─────────────────────────────────────────────

// GET /profile/me
router.get("/profile/me", verifyToken, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: req.user.userId },
      include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("[USER] /profile/me error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
});

// PATCH /profile/me
router.patch("/profile/me", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, displayName, avatarUrl, phone, timezone, locale } = req.body;

    const profile = await prisma.userProfile.update({
      where: { authUserId: req.user.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(phone !== undefined && { phone }),
        ...(timezone !== undefined && { timezone }),
        ...(locale !== undefined && { locale }),
      },
    });

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("[USER] Profile update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

// GET /profile/:userId — Admin can fetch any profile
router.get("/profile/:userId", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: req.params.userId },
      include: { organization: true },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
});

// ─────────────────────────────────────────────
// ORGANIZATION ROUTES
// ─────────────────────────────────────────────

// POST /organizations — ORG_ADMIN creates their org
router.post("/organizations", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const { name, description, website, industry, size, billingEmail } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Organization name required" });
    }

    // Check if user already owns an org
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: req.user.userId },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    if (profile.organizationId) {
      return res.status(409).json({ success: false, message: "You already belong to an organization" });
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${crypto.randomBytes(3).toString("hex")}`;

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: { name, slug, description, website, industry, size, billingEmail },
      });

      // Link user to org + create membership
      await tx.userProfile.update({
        where: { id: profile.id },
        data: { organizationId: newOrg.id },
      });

      await tx.organizationMember.create({
        data: { userId: profile.id, organizationId: newOrg.id, role: "ORG_ADMIN" },
      });

      return newOrg;
    });

    // [FIX-2] Notify Subscription Service to create default plan
    // Added x-internal-secret so internal route doesn't 403
    try {
      await axios.post(
        `${process.env.SUBSCRIPTION_SERVICE_URL}/api/subscriptions/internal/initialize`,
        { organizationId: org.id, plan: "FREE" },
        {
          headers: internalHeaders(req.headers.authorization), // [FIX-2] was missing secret
          timeout: 5000,
        }
      );
      console.log("[USER] Subscription initialized ✅");
    } catch (err) {
      console.error("[USER] Subscription init failed:", err.message);
    }

    // [FIX-2] Notify Notification Service — org created email + in-app
    try {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: profile.authUserId,
          title: "Organization Created",
          body: `Your organization "${org.name}" has been created successfully.`,
          type: "IN_APP",
          priority: "NORMAL",
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );

      // Also send email
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: profile.authUserId,
          title: `Organization "${org.name}" Created`,
          body: `Your organization has been created successfully.`,
          type: "EMAIL",
          toEmail: profile.email,
          subject: `Organization "${org.name}" Created Successfully`,
          htmlBody: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2>Organization Created 🎉</h2>
              <p>Hi ${profile.firstName || "there"},</p>
              <p>Your organization <strong>${org.name}</strong> has been created successfully.</p>
              <p>You are now the <strong>Admin</strong> of this organization.</p>
              <p>You can start inviting team members and managing your workspace.</p>
              <p style="color:#666;font-size:13px">— SaaS Platform Team</p>
            </div>
          `,
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );
      console.log("[USER] Org-created notification sent ✅");
    } catch (err) {
      console.error("[USER] Org notification failed:", err?.response?.data || err.message);
    }

    return res.status(201).json({ success: true, data: org });
  } catch (err) {
    console.error("[USER] Create org error:", err);
    return res.status(500).json({ success: false, message: "Failed to create organization" });
  }
});

// GET /organizations/mine
router.get("/organizations/mine", verifyToken, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: req.user.userId },
      include: {
        organization: {
          include: {
            memberships: {
              where: { isActive: true },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
            },
          },
        },
      },
    });

    if (!profile?.organization) {
      return res.status(404).json({ success: false, message: "No organization found" });
    }

    return res.status(200).json({ success: true, data: profile.organization });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch organization" });
  }
});

// PATCH /organizations/:id
router.patch("/organizations/:id", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    const { name, description, logoUrl, website, industry, size, billingEmail } = req.body;

    const profile = await prisma.userProfile.findUnique({ where: { authUserId: req.user.userId } });

    if (!profile || profile.organizationId !== req.params.id) {
      return res.status(403).json({ success: false, message: "Not authorized for this organization" });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry }),
        ...(size !== undefined && { size }),
        ...(billingEmail !== undefined && { billingEmail }),
      },
    });

    return res.status(200).json({ success: true, data: org });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update organization" });
  }
});

// GET /organizations/:id/members
router.get("/organizations/:id/members", verifyToken, isOrgManager, async (req, res) => {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: req.params.id, isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return res.status(200).json({ success: true, data: members });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch members" });
  }
});

// DELETE /organizations/:id/members/:userId
router.delete("/organizations/:id/members/:userId", verifyToken, isOrgAdmin, async (req, res) => {
  try {
    await prisma.organizationMember.updateMany({
      where: { userId: req.params.userId, organizationId: req.params.id },
      data: { isActive: false },
    });

    return res.status(200).json({ success: true, message: "Member removed" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to remove member" });
  }
});

// ─────────────────────────────────────────────
// [NEW-1] POST /organizations/:id/members/add
// ─────────────────────────────────────────────
/**
 * ORG_ADMIN / ORG_MANAGER directly add kare kisi existing registered
 * user ko apni organization mein — bina invite flow ke.
 *
 * Use case: User already platform pe registered hai, bas org mein
 * add karna hai. Invite token ki zaroorat nahi.
 *
 * Body: { email, role? }
 *
 * Guards:
 *  - Caller must belong to this org (ownership check)
 *  - Target user must already exist on platform
 *  - Target user must NOT already be in this org
 *  - Cannot add yourself
 *
 * Notifications: email + in-app dono target user ko
 */
router.post("/organizations/:id/members/add", verifyToken, isOrgManager, async (req, res) => {
  try {
    const { email, role } = req.body;
    const orgId = req.params.id;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // ── Caller must belong to this org ────────────────────
    const caller = await prisma.userProfile.findUnique({
      where: { authUserId: req.user.userId },
    });

    if (!caller || caller.organizationId !== orgId) {
      return res.status(403).json({ success: false, message: "You don't belong to this organization" });
    }

    // ── Target user exist karta hai? ──────────────────────
    const targetUser = await prisma.userProfile.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email. Use invite instead.",
      });
    }

    // ── Self-add block ────────────────────────────────────
    if (targetUser.authUserId === req.user.userId) {
      return res.status(400).json({ success: false, message: "You cannot add yourself" });
    }

    // ── Already member check ──────────────────────────────
    if (targetUser.organizationId === orgId) {
      return res.status(409).json({ success: false, message: "User is already a member of this organization" });
    }

    // ── Agar user kisi aur org mein hai toh block karo ────
    if (targetUser.organizationId && targetUser.organizationId !== orgId) {
      return res.status(409).json({
        success: false,
        message: "User already belongs to another organization",
      });
    }

    const assignedRole = role || "ORG_USER";

    // ── Add to org ────────────────────────────────────────
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: targetUser.id },
        data: { organizationId: orgId, role: assignedRole },
      }),
      prisma.organizationMember.upsert({
        where: { userId_organizationId: { userId: targetUser.id, organizationId: orgId } },
        create: { userId: targetUser.id, organizationId: orgId, role: assignedRole },
        update: { role: assignedRole, isActive: true },
      }),
    ]);

    // ── Fetch org name for notification ───────────────────
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    // ── Notifications: email + in-app ─────────────────────
    try {
      // In-app
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: targetUser.authUserId,
          title: "You've been added to an organization",
          body: `${caller.firstName || "An admin"} has added you to ${org?.name || "an organization"} as ${assignedRole.replace("_", " ")}.`,
          type: "IN_APP",
          priority: "HIGH",
        },
        { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
      );

      // Email
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: targetUser.authUserId,
          title: `Added to ${org?.name || "an organization"}`,
          body: `You have been added to ${org?.name}.`,
          type: "EMAIL",
          toEmail: targetUser.email,
          subject: `You've been added to ${org?.name || "an organization"}`,
          htmlBody: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2>You've been added! 🎉</h2>
              <p>Hi ${targetUser.firstName || "there"},</p>
              <p>
                <strong>${caller.firstName || "An administrator"}</strong> has added you to
                <strong>${org?.name || "an organization"}</strong> on the platform.
              </p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr>
                  <td style="padding:8px;border:1px solid #e5e7eb;color:#666">Organization</td>
                  <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">${org?.name || "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px;border:1px solid #e5e7eb;color:#666">Your Role</td>
                  <td style="padding:8px;border:1px solid #e5e7eb">${assignedRole.replace("_", " ")}</td>
                </tr>
                <tr>
                  <td style="padding:8px;border:1px solid #e5e7eb;color:#666">Added By</td>
                  <td style="padding:8px;border:1px solid #e5e7eb">${caller.firstName || ""} ${caller.lastName || ""}</td>
                </tr>
              </table>
              <p>You can now log in and start collaborating with your team.</p>
              <p style="color:#666;font-size:13px">
                If this was unexpected, please contact support. — SaaS Platform Team
              </p>
            </div>
          `,
        },
        { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
      );
      console.log("[USER] Direct-add notification sent ✅ →", targetUser.email);
    } catch (notifyErr) {
      console.error("[USER] Direct-add notification failed:", notifyErr?.response?.data || notifyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `${targetUser.firstName || targetUser.email} added to organization successfully`,
      data: {
        userId: targetUser.id,
        email: targetUser.email,
        role: assignedRole,
        organizationId: orgId,
      },
    });
  } catch (err) {
    console.error("[USER] Direct-add error:", err);
    return res.status(500).json({ success: false, message: "Failed to add member" });
  }
});

// ─────────────────────────────────────────────
// [NEW-2] POST /organizations/:id/members/bulk-invite
// ─────────────────────────────────────────────
/**
 * Ek saath multiple emails ko organization invite bhejo.
 * Max 50 emails per request.
 *
 * Body: { invites: [{ email, role? }, ...] }
 *
 * Response breakdown:
 *  - sent:    Invite successfully bheja + notification sent
 *  - skipped: Already member / already pending invite
 *  - failed:  DB ya notification error
 *
 * Har valid email ke liye:
 *  1. Invitation record create hota hai
 *  2. Notification Service ko invite email bheja jaata hai
 *     (same as single invite — uses /internal/invite route)
 *
 * Guards:
 *  - Caller must belong to this org
 *  - Max 50 emails per request
 */
router.post("/organizations/:id/members/bulk-invite", verifyToken, isOrgManager, async (req, res) => {
  try {
    const { invites } = req.body; // [{ email, role? }, ...]
    const orgId = req.params.id;

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ success: false, message: "invites array required" });
    }

    if (invites.length > 50) {
      return res.status(400).json({ success: false, message: "Maximum 50 invites per request" });
    }

    // ── Caller must belong to this org ────────────────────
    const caller = await prisma.userProfile.findUnique({
      where: { authUserId: req.user.userId },
    });

    if (!caller || caller.organizationId !== orgId) {
      return res.status(403).json({ success: false, message: "You don't belong to this organization" });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    // ── Existing members ke emails fetch karo ─────────────
    const existingMembers = await prisma.userProfile.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { email: true },
    });
    const existingEmails = new Set(existingMembers.map((m) => m.email.toLowerCase()));

    // ── Pending invites ke emails fetch karo ──────────────
    const pendingInvites = await prisma.invitation.findMany({
      where: { organizationId: orgId, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { email: true },
    });
    const pendingEmails = new Set(pendingInvites.map((i) => i.email.toLowerCase()));

    // ── Results tracker ───────────────────────────────────
    const results = { sent: [], skipped: [], failed: [] };

    // ── Process each invite ───────────────────────────────
    for (const item of invites) {
      const email = item.email?.toLowerCase()?.trim();
      const role = item.role || "ORG_USER";

      if (!email) {
        results.failed.push({ email: item.email, reason: "Invalid email" });
        continue;
      }

      // Skip already members
      if (existingEmails.has(email)) {
        results.skipped.push({ email, reason: "Already a member" });
        continue;
      }

      // Skip already has pending invite
      if (pendingEmails.has(email)) {
        results.skipped.push({ email, reason: "Invite already pending" });
        continue;
      }

      try {
        // Create invite record
        const invite = await prisma.invitation.create({
          data: {
            email,
            role,
            organizationId: orgId,
            invitedById: caller.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // Send notification (fire-and-forget per email)
        try {
          await axios.post(
            `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/invite`,
            {
              email,
              inviteToken: invite.token,
              organizationId: orgId,
              organizationName: org?.name,
            },
            { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
          );
        } catch (notifyErr) {
          // Notification fail hone se invite cancel nahi hoga
          console.error(`[USER] Bulk invite notify failed for ${email}:`, notifyErr?.response?.data || notifyErr.message);
        }

        results.sent.push({ email, role, inviteId: invite.id });
        pendingEmails.add(email); // Prevent duplicate in same batch
      } catch (dbErr) {
        console.error(`[USER] Bulk invite DB error for ${email}:`, dbErr.message);
        results.failed.push({ email, reason: "Database error" });
      }
    }

    console.log(`[USER] Bulk invite done — sent:${results.sent.length} skipped:${results.skipped.length} failed:${results.failed.length}`);

    return res.status(200).json({
      success: true,
      message: `Bulk invite complete — ${results.sent.length} sent, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      data: results,
    });
  } catch (err) {
    console.error("[USER] Bulk invite error:", err);
    return res.status(500).json({ success: false, message: "Failed to process bulk invites" });
  }
});

// ─────────────────────────────────────────────
// INVITATION ROUTES
// ─────────────────────────────────────────────

// POST /invitations
router.post("/invitations", verifyToken, isOrgManager, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const inviter = await prisma.userProfile.findUnique({ where: { authUserId: req.user.userId } });

    if (!inviter?.organizationId) {
      return res.status(400).json({ success: false, message: "You must belong to an organization" });
    }

    // Prevent inviting existing members
    const existing = await prisma.userProfile.findFirst({
      where: { email, organizationId: inviter.organizationId },
    });

    if (existing) {
      return res.status(409).json({ success: false, message: "User is already a member" });
    }

    const org = await prisma.organization.findUnique({ where: { id: inviter.organizationId } });

    const invite = await prisma.invitation.create({
      data: {
        email,
        role: role || "ORG_USER",
        organizationId: inviter.organizationId,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // [FIX-1] Added x-internal-secret header — was missing before causing 403
    try {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/invite`,
        {
          email,
          inviteToken: invite.token,
          organizationId: inviter.organizationId,
          organizationName: org?.name,
        },
        {
          headers: internalHeaders(req.headers.authorization), // [FIX-1] secret now included
          timeout: 5000,
        }
      );
      console.log("[USER] Invite notification sent ✅");
    } catch (err) {
      console.error("[USER] Invite notification failed:", err?.response?.data || err.message);
    }

    return res.status(201).json({ success: true, data: { inviteId: invite.id, token: invite.token } });
  } catch (err) {
    console.error("[USER] Invite error:", err);
    return res.status(500).json({ success: false, message: "Failed to send invite" });
  }
});

// GET /invitations/:token
router.get("/invitations/:token", async (req, res) => {
  try {
    const invite = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { organization: { select: { id: true, name: true, logoUrl: true } } },
    });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: "Invitation not found or expired" });
    }

    return res.status(200).json({ success: true, data: invite });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch invitation" });
  }
});

// POST /invitations/:token/accept
router.post("/invitations/:token/accept", verifyToken, async (req, res) => {
  try {
    const invite = await prisma.invitation.findUnique({ where: { token: req.params.token } });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invitation invalid or expired" });
    }

    if (invite.email !== req.user.email) {
      return res.status(403).json({ success: false, message: "This invite is for a different email" });
    }

    const profile = await prisma.userProfile.findUnique({ where: { authUserId: req.user.userId } });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    await prisma.$transaction([
      prisma.invitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      }),
      prisma.userProfile.update({
        where: { id: profile.id },
        data: { organizationId: invite.organizationId, role: invite.role },
      }),
      prisma.organizationMember.upsert({
        where: { userId_organizationId: { userId: profile.id, organizationId: invite.organizationId } },
        create: { userId: profile.id, organizationId: invite.organizationId, role: invite.role },
        update: { role: invite.role, isActive: true },
      }),
    ]);

    // [FIX-4] Notify user — invitation accepted, welcome to org
    try {
      const org = await prisma.organization.findUnique({ where: { id: invite.organizationId } });

      // In-app notification
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: req.user.userId,
          title: "You've joined an organization",
          body: `You have successfully joined ${org?.name || "an organization"}.`,
          type: "IN_APP",
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );

      // Email confirmation
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: req.user.userId,
          title: "Invitation Accepted",
          body: `You have joined ${org?.name || "an organization"}.`,
          type: "EMAIL",
          toEmail: invite.email,
          subject: `Welcome to ${org?.name || "the organization"}!`,
          htmlBody: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2>You're in! 🎉</h2>
              <p>Hi ${profile.firstName || "there"},</p>
              <p>You have successfully joined <strong>${org?.name || "the organization"}</strong> as <strong>${invite.role.replace("_", " ")}</strong>.</p>
              <p>You can now log in and start collaborating with your team.</p>
              <p style="color:#666;font-size:13px">— SaaS Platform Team</p>
            </div>
          `,
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );
      console.log("[USER] Invite-accepted notification sent ✅");
    } catch (err) {
      console.error("[USER] Invite-accept notification failed:", err?.response?.data || err.message);
    }

    return res.status(200).json({ success: true, message: "Invitation accepted" });
  } catch (err) {
    console.error("[USER] Accept invite error:", err);
    return res.status(500).json({ success: false, message: "Failed to accept invitation" });
  }
});

// DELETE /invitations/:id — revoke
router.delete("/invitations/:id", verifyToken, isOrgManager, async (req, res) => {
  try {
    await prisma.invitation.update({
      where: { id: req.params.id },
      data: { status: "REVOKED" },
    });
    return res.status(200).json({ success: true, message: "Invitation revoked" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to revoke invitation" });
  }
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// GET /admin/users
router.get("/admin/users", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      isActive: true,
      ...(role && { role }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        skip,
        take: Number(limit),
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userProfile.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// GET /admin/organizations
router.get("/admin/organizations", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      isActive: true,
      ...(search && { name: { contains: search, mode: "insensitive" } }),
    };

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: Number(limit),
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: orgs,
      meta: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch organizations" });
  }
});

// PATCH /admin/users/:id/role
router.patch("/admin/users/:id/role", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_AGENT", "ORG_ADMIN", "ORG_MANAGER", "ORG_USER"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const updated = await prisma.userProfile.update({
      where: { id: req.params.id },
      data: { role },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update role" });
  }
});

// DELETE /admin/users/:id — soft delete + notifications
router.delete("/admin/users/:id", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent self-delete
    if (user.authUserId === req.user.userId) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    await prisma.userProfile.update({
      where: { id: req.params.id },
      data: { isActive: false, deletedAt: new Date() },
    });

    // [FIX-3] Notify Notification Service — account-deleted email + in-app
    try {
      // Dedicated account-deleted email route
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/account-deleted`,
        {
          email: user.email,
          firstName: user.firstName,
          deletedBy: req.user.userId,
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );

      // In-app notification (so it appears in their feed if they log in again)
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
        {
          userId: user.authUserId,
          title: "Account Deactivated",
          body: "Your account has been removed by an administrator.",
          type: "IN_APP",
          priority: "HIGH",
        },
        {
          headers: internalHeaders(req.headers.authorization),
          timeout: 5000,
        }
      );
      console.log("[USER] Account-deleted notifications sent ✅");
    } catch (notifyErr) {
      console.error("[USER] Account-deleted notification failed:", notifyErr?.response?.data || notifyErr.message);
    }

    return res.status(200).json({ success: true, message: "User deactivated" });
  } catch (err) {
    console.error("[USER] Delete user error:", err);
    return res.status(500).json({ success: false, message: "Failed to deactivate user" });
  }
});

// ─────────────────────────────────────────────
// INTERNAL ROUTES (service-to-service)
// ─────────────────────────────────────────────

// POST /internal/create — Called by Auth Service after register
router.post("/internal/create", async (req, res) => {
  try {
    const { authUserId, email, role, firstName, lastName } = req.body;

    // Idempotent — don't fail if already exists
    const existing = await prisma.userProfile.findUnique({ where: { authUserId } });
    if (existing) {
      return res.status(200).json({ success: true, data: existing });
    }

    const profile = await prisma.userProfile.create({
      data: { authUserId, email, role: role || "ORG_USER", firstName: firstName || email.split("@")[0], lastName: lastName || "" },
    });

    return res.status(201).json({ success: true, data: profile });
  } catch (err) {
    console.error("[USER] Internal create error:", err);
    return res.status(500).json({ success: false, message: "Profile creation failed" });
  }
});

// GET /internal/:authUserId — Called by other services
router.get("/internal/:authUserId", async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: req.params.authUserId },
      include: { organization: true },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
});



/**
 * POST /organizations/:id/users/provision
 *
 * Directly provision a new user into an organization without invite flow.
 * Creates an auth account with an auto-generated password, builds the
 * UserProfile, links them to the org, and emails credentials to the user.
 *
 * Access:   ORG_ADMIN | PLATFORM_ADMIN | SUPER_ADMIN
 * Params:   :id  — organizationId
 *
 * Body:
 *   email      string   required
 *   firstName  string   required
 *   lastName   string   optional
 *   role       "ORG_USER" | "ORG_MANAGER"  default: ORG_USER
 *   phone      string   optional
 *
 * Responses:
 *   201  — user provisioned, returns profile + tempPassword (shown once)
 *   400  — missing required fields or invalid role
 *   403  — caller does not belong to this org
 *   404  — organization not found
 *   409  — email already registered
 *   422  — organization has reached its plan user limit
 *   502  — Auth Service failed to create the account
 *   500  — unexpected server error
 */
router.post(
  "/organizations/:id/users/provision",
  verifyToken,
  isOrgAdmin,
  async (req, res) => {
    const orgId = req.params.id;

    try {
      // ── Validate request body ────────────────────────────────────────────
      const { email, firstName, lastName = "", role = "ORG_USER", phone } = req.body;

      if (!email || !firstName) {
        return res.status(400).json({
          success: false,
          message: "email and firstName are required",
        });
      }

      const allowedRoles = ["ORG_USER", "ORG_MANAGER"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "role must be ORG_USER or ORG_MANAGER",
        });
      }

      // ── Verify caller belongs to the target org (skip for platform admins) ─
      const isPlatform = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user.role);

      if (!isPlatform) {
        const callerProfile = await prisma.userProfile.findUnique({
          where: { authUserId: req.user.userId },
        });

        if (callerProfile?.organizationId !== orgId) {
          return res.status(403).json({
            success: false,
            message: "You can only provision users into your own organization",
          });
        }
      }

      // ── Confirm organization exists and is active ────────────────────────
      const org = await prisma.organization.findUnique({
        where: { id: orgId, isActive: true },
      });

      if (!org) {
        return res.status(404).json({ success: false, message: "Organization not found" });
      }

      // ── Check plan user limit against Subscription Service ───────────────
      // Falls back to 10 if the Subscription Service is unreachable.
      let maxUsers = 10;

      try {
        const subRes = await axios.get(
          `${process.env.SUBSCRIPTION_SERVICE_URL}/api/subscriptions/internal/${orgId}`,
          {
            headers: internalHeaders(req.headers.authorization),
            timeout: 5000,
          }
        );
        if (subRes.data?.success && subRes.data.data?.limits?.maxUsers) {
          maxUsers = subRes.data.data.limits.maxUsers;
        }
        console.log(`[USER] Plan user limit: ${maxUsers}`);
      } catch (subErr) {
        console.error("[USER] Subscription Service unreachable, using fallback limit:", subErr.message);
      }

      const currentMemberCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, isActive: true },
      });

      if (currentMemberCount >= maxUsers) {
        return res.status(422).json({
          success: false,
          message: `User limit reached. Your plan allows a maximum of ${maxUsers} users. Current count: ${currentMemberCount}. Please upgrade your plan.`,
          data: {
            currentCount: currentMemberCount,
            maxAllowed: maxUsers,
          },
        });
      }

      // ── Reject if email is already registered in User Service ────────────
      const existingProfile = await prisma.userProfile.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered. Use POST /organizations/:id/members/add instead.",
        });
      }

      // ── Generate a readable but secure temporary password ────────────────
      // Format: Adjective + Noun + Symbol + 4-digit number  e.g. SwiftEagle@4291
      const adjectives = ["Quick", "Bright", "Smart", "Bold", "Fresh", "Swift", "Clear", "Cool"];
      const nouns = ["Tiger", "River", "Storm", "Eagle", "Spark", "Flame", "Cloud", "Stone"];
      const symbols = ["@", "#", "!", "$"];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const num = Math.floor(Math.random() * 9000) + 1000;
      const tempPassword = `${adj}${noun}${sym}${num}`;

      // ── Create auth account in Auth Service ─────────────────────────────
      let authUser;
      try {
        const authRes = await axios.post(
          `${process.env.AUTH_SERVICE_URL}/api/auth/internal/provision`,
          {
            email: email.toLowerCase().trim(),
            password: tempPassword,
            role,
            firstName,
            lastName,
            mustChangePassword: true,
          },
          {
            headers: internalHeaders(req.headers.authorization),
            timeout: 8000,
          }
        );
        authUser = authRes.data?.data;
        console.log(`[USER] Auth account provisioned: ${authUser?.id}`);
      } catch (authErr) {
        const msg = authErr?.response?.data?.message || authErr.message;
        console.error("[USER] Auth Service provision failed:", msg);

        if (authErr?.response?.status === 409) {
          return res.status(409).json({
            success: false,
            message: "This email already exists in Auth Service",
          });
        }

        return res.status(502).json({
          success: false,
          message: `Auth Service failed to create the account: ${msg}`,
        });
      }

      // ── Create UserProfile and OrganizationMember in a single transaction ─
      // If the DB write fails, the Auth account is rolled back (best effort).
      let newProfile;
      try {
        newProfile = await prisma.$transaction(async (tx) => {
          const profile = await tx.userProfile.create({
            data: {
              authUserId: authUser.id,
              email: email.toLowerCase().trim(),
              firstName,
              lastName,
              phone: phone || null,
              role,
              organizationId: orgId,
            },
          });

          await tx.organizationMember.create({
            data: {
              userId: profile.id,
              organizationId: orgId,
              role,
              isActive: true,
            },
          });

          return profile;
        });
        console.log(`[USER] UserProfile + OrganizationMember created: ${newProfile.id}`);
      } catch (dbErr) {
        console.error("[USER] DB transaction failed:", dbErr.message);

        // Attempt to delete the Auth account to avoid orphaned records
        try {
          await axios.delete(
            `${process.env.AUTH_SERVICE_URL}/api/auth/internal/users/${authUser.id}`,
            {
              headers: internalHeaders(req.headers.authorization),
              timeout: 5000,
            }
          );
          console.log("[USER] Auth account rollback successful");
        } catch (rollbackErr) {
          console.error("[USER] Auth account rollback failed:", rollbackErr.message);
        }

        return res.status(500).json({
          success: false,
          message: "Failed to create user profile. Please try again.",
        });
      }

      // ── Send welcome email with login credentials (fire-and-forget) ──────
      try {
        await axios.post(
          `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
          {
            userId: authUser.id,
            title: `Your account at ${org.name} has been created`,
            body: `Your account has been created at ${org.name}. Please log in using your credentials.`,
            type: "EMAIL",
            toEmail: email.toLowerCase().trim(),
            subject: `Welcome to ${org.name} — Your Login Credentials`,
            htmlBody: `
              <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px">
                <h2 style="color:#111;margin-bottom:4px">Welcome to ${org.name}!</h2>
                <p style="color:#555">Hi ${firstName}, your account has been set up by an administrator.</p>

                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:20px;margin:20px 0">
                  <p style="margin:0 0 12px;color:#666;font-size:13px;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Login Details</p>
                  <table style="width:100%;border-collapse:collapse">
                    <tr>
                      <td style="padding:8px 0;color:#666;width:120px">Email</td>
                      <td style="padding:8px 0;font-weight:600;color:#111">${email.toLowerCase().trim()}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#666">Password</td>
                      <td style="padding:8px 0;font-weight:700;color:#111;font-family:monospace;font-size:16px;letter-spacing:1px">${tempPassword}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#666">Role</td>
                      <td style="padding:8px 0;color:#111">${role.replace("_", " ")}</td>
                    </tr>
                  </table>
                </div>

                <p style="color:#e53e3e;font-size:13px">
                  ⚠️ <strong>Security Notice:</strong> You will be required to change your password on first login.
                </p>

                <p style="color:#555;font-size:13px">
                  If you did not expect this email, please contact your administrator.
                </p>

                <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
                  — ${org.name} Admin Team
                </p>
              </div>
            `,
          },
          {
            headers: internalHeaders(req.headers.authorization),
            timeout: 5000,
          }
        );

        // In-app notification so it appears in their feed on first login
        await axios.post(
          `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
          {
            userId: authUser.id,
            title: `Welcome to ${org.name}!`,
            body: "Your account has been created by an admin. Check your email for login credentials.",
            type: "IN_APP",
            priority: "HIGH",
          },
          {
            headers: internalHeaders(req.headers.authorization),
            timeout: 5000,
          }
        );

        console.log("[USER] Credentials notification sent");
      } catch (notifyErr) {
        console.error("[USER] Credentials notification failed:", notifyErr?.response?.data || notifyErr.message);
      }

      // ── Return provisioned user details ──────────────────────────────────
      // tempPassword is returned here only — it is not stored in plain text anywhere.
      return res.status(201).json({
        success: true,
        message: "User provisioned successfully",
        data: {
          userId: newProfile.id,
          authUserId: authUser.id,
          email: newProfile.email,
          firstName: newProfile.firstName,
          lastName: newProfile.lastName,
          role: newProfile.role,
          tempPassword,
          organizationId: orgId,
          mustChangePassword: true,
          memberCount: {
            current: currentMemberCount + 1,
            max: maxUsers,
          },
        },
      });
    } catch (err) {
      console.error("[USER] Provision user error:", err);
      return res.status(500).json({ success: false, message: "Failed to provision user" });
    }
  }
);

export default router;