/**
 * ============================================================
 * 🎯 LEAD SERVICE — routes.js
 * ============================================================
 *
 * Profile Routes:
 *  POST   /leads                          → Create lead (manual)
 *  GET    /leads                          → List leads (paginated + filters)
 *  GET    /leads/:id                      → Single lead detail
 *  PATCH  /leads/:id                      → Update lead
 *  DELETE /leads/:id                      → Soft delete lead
 *  PATCH  /leads/:id/status               → Change status
 *  PATCH  /leads/:id/score                → Change hot/warm/cold
 *  PATCH  /leads/:id/assign               → Assign to agent
 *  PATCH  /leads/:id/pipeline             → Move pipeline stage
 *
 * Activity Routes:
 *  GET    /leads/:id/activities           → Lead timeline
 *  POST   /leads/:id/activities           → Add note/activity
 *
 * Follow-Up Routes:
 *  GET    /leads/:id/follow-ups           → Lead's follow-ups
 *  POST   /leads/:id/follow-ups           → Schedule follow-up
 *  PATCH  /follow-ups/:id                 → Update follow-up
 *  DELETE /follow-ups/:id                 → Delete follow-up
 *
 * Bulk Import Routes:
 *  POST   /leads/import/csv               → Upload CSV
 *  GET    /leads/import/jobs              → Import job status list
 *  GET    /leads/import/jobs/:id          → Single job status
 *
 * Dashboard Routes:
 *  GET    /leads/stats/overview           → Lead count by status/score
 *  GET    /leads/stats/pipeline           → Pipeline funnel counts
 *  GET    /leads/stats/agent              → Per-agent lead stats
 *
 * Admin Routes (SUPER_ADMIN / PLATFORM_ADMIN):
 *  GET    /admin/leads                    → All leads across orgs
 *
 * Internal Routes:
 *  POST   /internal/facebook-webhook      → Facebook Lead Ads webhook
 *  POST   /internal/update-ai-insights    → Called by Calling Service after AI call
 *  POST   /internal/log-call              → Called by Calling Service to sync call
 * ============================================================
 */

import express    from "express";
import jwt        from "jsonwebtoken";
import axios      from "axios";
import multer     from "multer";
import csvParser  from "csv-parser";
import { Readable } from "stream";
import prisma     from "../../utils/prisma.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ============================================================
// ⚙️  CONSTANTS
// ============================================================

const ALLOWED_ORG_ROLES = ["ORG_ADMIN", "ORG_MANAGER", "ORG_USER"];
const CSV_REQUIRED_FIELDS = ["firstName", "phone"];
const MAX_CSV_ROWS = 1000;

// ============================================================
// 🛡️  MIDDLEWARE
// ============================================================

export const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token required" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
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
const isOrgManager    = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER");

/**
 * validateOrgAccess
 * -----------------
 * Ensures the calling user belongs to the same org as the lead/resource.
 * Platform admins bypass this check.
 */
const validateOrgAccess = async (req, res, next) => {
  try {
    if (["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user.role)) return next();

    const profile = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/users/internal/${req.user.userId}`,
      { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
    );

    req.organizationId = profile.data?.data?.organizationId;

    if (!req.organizationId) {
      return res.status(403).json({ success: false, message: "You don't belong to any organization" });
    }
    next();
  } catch (err) {
    console.error("[LEAD] validateOrgAccess error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to validate org access" });
  }
};

// ============================================================
// 🌐  HELPERS
// ============================================================

const internalHeaders = (authHeader) => ({
  Authorization:       authHeader,
  "x-internal-secret": process.env.INTERNAL_SECRET,
});

/**
 * logActivity
 * -----------
 * Adds a row to LeadActivity table.
 * Always fire-and-forget from routes — never block main flow.
 */
const logActivity = async (leadId, performedById, type, title, description = null, metadata = null) => {
  try {
    await prisma.leadActivity.create({
      data: { leadId, performedById, type, title, description, metadata },
    });
  } catch (err) {
    console.error("[LEAD] logActivity error:", err.message);
  }
};

/**
 * notifyAgent
 * -----------
 * Sends an in-app notification to an agent via Notification Service.
 * Fire-and-forget — never blocks main flow.
 */
const notifyAgent = async (authHeader, userId, title, body, priority = "NORMAL") => {
  try {
    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
      { userId, title, body, type: "IN_APP", priority },
      { headers: internalHeaders(authHeader), timeout: 5000 }
    );
  } catch (err) {
    console.error("[LEAD] notifyAgent error:", err.message);
  }
};

// ============================================================
// ============================================================
// 📌  ROUTES
// ============================================================
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /leads — Create lead manually
// ────────────────────────────────────────────────────────────
/**
 * Create a new lead manually.
 *
 * Body: { firstName, lastName?, phone, email?, propertyType?,
 *         budget?, location?, source?, notes?, assignedToId? }
 */
router.post("/leads", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, email,
      propertyType, budget, budgetMin, budgetMax,
      location, bhkPreference, source,
      notes, assignedToId,
    } = req.body;

    if (!firstName || !phone) {
      return res.status(400).json({ success: false, message: "firstName and phone are required" });
    }

    // Prevent duplicate phone in same org
    const existing = await prisma.lead.findFirst({
      where: { phone, organizationId: req.organizationId, isActive: true },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A lead with this phone number already exists",
        data: { leadId: existing.id },
      });
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: req.organizationId,
        firstName,
        lastName:     lastName || "",
        phone,
        email:        email || null,
        propertyType: propertyType || null,
        budget:       budget || null,
        budgetMin:    budgetMin || null,
        budgetMax:    budgetMax || null,
        location:     location || null,
        bhkPreference: bhkPreference || null,
        source:       source || "MANUAL",
        notes:        notes || null,
        assignedToId: assignedToId || req.user.userId,
      },
    });

    // Log activity
    await logActivity(lead.id, req.user.userId, "NOTE_ADDED", "Lead created", notes || null);

    // Notify assigned agent (if different from creator)
    if (assignedToId && assignedToId !== req.user.userId) {
      notifyAgent(
        req.headers.authorization,
        assignedToId,
        "New Lead Assigned",
        `A new lead "${firstName} ${lastName || ""}" has been assigned to you.`,
        "HIGH"
      );
    }

    return res.status(201).json({ success: true, data: lead });
  } catch (err) {
    console.error("[LEAD] Create error:", err);
    return res.status(500).json({ success: false, message: "Failed to create lead" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads — List leads (paginated + filters)
// ────────────────────────────────────────────────────────────
/**
 * Query params:
 *  page, limit, status, score, source, assignedToId,
 *  pipelineStage, search (name/phone/email), dateFrom, dateTo
 */
router.get("/leads", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, score, source,
      assignedToId, pipelineStage,
      search, dateFrom, dateTo,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Agents can only see their own leads; managers+ see all
    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);

    const where = {
      organizationId: req.organizationId,
      isActive:       true,
      ...(status        && { status }),
      ...(score         && { score }),
      ...(source        && { source }),
      ...(pipelineStage && { pipelineStage }),
      ...(!canSeeAll    && { assignedToId: req.user.userId }),
      ...(assignedToId && canSeeAll && { assignedToId }),
      ...(search && {
        OR: [
          { firstName:  { contains: search, mode: "insensitive" } },
          { lastName:   { contains: search, mode: "insensitive" } },
          { phone:      { contains: search } },
          { email:      { contains: search, mode: "insensitive" } },
          { location:   { contains: search, mode: "insensitive" } },
        ],
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take:    Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { activities: true, calls: true, followUps: true } },
          tags:   { select: { tag: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data:    leads,
      meta: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("[LEAD] List error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/:id — Single lead detail
// ────────────────────────────────────────────────────────────
router.get("/leads/:id", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        followUps:  { orderBy: { scheduledAt: "asc" }, where: { status: "PENDING" } },
        calls:      { orderBy: { createdAt: "desc" }, take: 10 },
        tags:       true,
      },
    });

    if (!lead || !lead.isActive) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    // Org access check (agents can only see their own leads)
    if (lead.organizationId !== req.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);
    if (!canSeeAll && lead.assignedToId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "This lead is not assigned to you" });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (err) {
    console.error("[LEAD] Get error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch lead" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /leads/:id — Update lead info
// ────────────────────────────────────────────────────────────
router.patch("/leads/:id", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const {
      firstName, lastName, phone, email,
      propertyType, budget, budgetMin, budgetMax,
      location, bhkPreference, notes,
    } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });

    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(firstName     !== undefined && { firstName }),
        ...(lastName      !== undefined && { lastName }),
        ...(phone         !== undefined && { phone }),
        ...(email         !== undefined && { email }),
        ...(propertyType  !== undefined && { propertyType }),
        ...(budget        !== undefined && { budget }),
        ...(budgetMin     !== undefined && { budgetMin }),
        ...(budgetMax     !== undefined && { budgetMax }),
        ...(location      !== undefined && { location }),
        ...(bhkPreference !== undefined && { bhkPreference }),
        ...(notes         !== undefined && { notes }),
      },
    });

    await logActivity(lead.id, req.user.userId, "NOTE_ADDED", "Lead info updated");

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] Update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /leads/:id — Soft delete
// ────────────────────────────────────────────────────────────
router.delete("/leads/:id", verifyToken, validateOrgAccess, isOrgManager, async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });

    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    await prisma.lead.update({
      where: { id: req.params.id },
      data:  { isActive: false, deletedAt: new Date() },
    });

    return res.status(200).json({ success: true, message: "Lead deleted" });
  } catch (err) {
    console.error("[LEAD] Delete error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete lead" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /leads/:id/status — Change lead status
// ────────────────────────────────────────────────────────────
router.patch("/leads/:id/status", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = ["NEW", "CONTACTED", "QUALIFIED", "VISIT_SCHEDULED", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST", "JUNK"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(["CLOSED_WON", "CLOSED_LOST"].includes(status) && { closedAt: new Date() }),
      },
    });

    await logActivity(
      lead.id, req.user.userId, "STATUS_CHANGED",
      `Status changed to ${status}`,
      notes || null,
      { from: lead.status, to: status }
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] Status update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /leads/:id/score — Change Hot/Warm/Cold
// ────────────────────────────────────────────────────────────
router.patch("/leads/:id/score", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { score } = req.body;

    if (!["HOT", "WARM", "COLD"].includes(score)) {
      return res.status(400).json({ success: false, message: "score must be HOT, WARM or COLD" });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data:  { score },
    });

    await logActivity(lead.id, req.user.userId, "STATUS_CHANGED", `Lead score changed to ${score}`, null, { from: lead.score, to: score });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] Score update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update score" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /leads/:id/assign — Assign lead to agent
// ────────────────────────────────────────────────────────────
router.patch("/leads/:id/assign", verifyToken, validateOrgAccess, isOrgManager, async (req, res) => {
  try {
    const { assignedToId } = req.body;

    if (!assignedToId) {
      return res.status(400).json({ success: false, message: "assignedToId required" });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data:  { assignedToId },
    });

    await logActivity(lead.id, req.user.userId, "ASSIGNED", `Lead assigned to ${assignedToId}`, null, { from: lead.assignedToId, to: assignedToId });

    // Notify new assignee
    notifyAgent(
      req.headers.authorization,
      assignedToId,
      "Lead Assigned to You",
      `Lead "${lead.firstName} ${lead.lastName}" has been assigned to you.`,
      "HIGH"
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] Assign error:", err);
    return res.status(500).json({ success: false, message: "Failed to assign lead" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /leads/:id/pipeline — Move pipeline stage
// ────────────────────────────────────────────────────────────
router.patch("/leads/:id/pipeline", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { pipelineStage } = req.body;
    const validStages = ["NEW_LEAD", "CONTACTED", "INTERESTED", "VISIT_SCHEDULED", "CLOSED"];

    if (!validStages.includes(pipelineStage)) {
      return res.status(400).json({ success: false, message: "Invalid pipeline stage" });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || !lead.isActive || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data:  { pipelineStage },
    });

    await logActivity(lead.id, req.user.userId, "STATUS_CHANGED", `Pipeline moved to ${pipelineStage}`, null, { from: lead.pipelineStage, to: pipelineStage });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] Pipeline update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update pipeline" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/:id/activities — Lead timeline
// ────────────────────────────────────────────────────────────
router.get("/leads/:id/activities", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const [activities, total] = await Promise.all([
      prisma.leadActivity.findMany({
        where:   { leadId: req.params.id },
        skip:    (Number(page) - 1) * Number(limit),
        take:    Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadActivity.count({ where: { leadId: req.params.id } }),
    ]);

    return res.status(200).json({ success: true, data: activities, meta: { total, page: Number(page) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch activities" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /leads/:id/activities — Add note/activity manually
// ────────────────────────────────────────────────────────────
router.post("/leads/:id/activities", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { type = "NOTE_ADDED", title, description, metadata } = req.body;

    if (!title) return res.status(400).json({ success: false, message: "title required" });

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const activity = await prisma.leadActivity.create({
      data: { leadId: req.params.id, performedById: req.user.userId, type, title, description: description || null, metadata: metadata || null },
    });

    // Update lastContactedAt on call/email activities
    if (["CALL_MADE", "EMAIL_SENT", "SMS_SENT"].includes(type)) {
      await prisma.lead.update({
        where: { id: req.params.id },
        data:  { lastContactedAt: new Date() },
      });
    }

    return res.status(201).json({ success: true, data: activity });
  } catch (err) {
    console.error("[LEAD] Add activity error:", err);
    return res.status(500).json({ success: false, message: "Failed to add activity" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/:id/follow-ups — Get follow-ups for a lead
// ────────────────────────────────────────────────────────────
router.get("/leads/:id/follow-ups", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const followUps = await prisma.leadFollowUp.findMany({
      where:   { leadId: req.params.id },
      orderBy: { scheduledAt: "asc" },
    });

    return res.status(200).json({ success: true, data: followUps });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch follow-ups" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /leads/:id/follow-ups — Schedule a follow-up
// ────────────────────────────────────────────────────────────
router.post("/leads/:id/follow-ups", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { title, description, scheduledAt, channel, assignedToId } = req.body;

    if (!title || !scheduledAt) {
      return res.status(400).json({ success: false, message: "title and scheduledAt required" });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead || lead.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const followUp = await prisma.leadFollowUp.create({
      data: {
        leadId:       req.params.id,
        assignedToId: assignedToId || req.user.userId,
        title,
        description:  description || null,
        scheduledAt:  new Date(scheduledAt),
        channel:      channel || "CALL",
      },
    });

    // Update lead's nextFollowUpAt
    await prisma.lead.update({
      where: { id: req.params.id },
      data:  { nextFollowUpAt: new Date(scheduledAt) },
    });

    await logActivity(lead.id, req.user.userId, "FOLLOW_UP_SCHEDULED", `Follow-up scheduled for ${new Date(scheduledAt).toDateString()}`, description || null);

    // Notify assigned agent
    const targetAgent = assignedToId || req.user.userId;
    if (targetAgent !== req.user.userId) {
      notifyAgent(
        req.headers.authorization, targetAgent,
        "Follow-up Scheduled",
        `You have a follow-up scheduled with "${lead.firstName}" on ${new Date(scheduledAt).toDateString()}.`
      );
    }

    return res.status(201).json({ success: true, data: followUp });
  } catch (err) {
    console.error("[LEAD] Schedule follow-up error:", err);
    return res.status(500).json({ success: false, message: "Failed to schedule follow-up" });
  }
});

// ────────────────────────────────────────────────────────────
// PATCH /follow-ups/:id — Update follow-up status
// ────────────────────────────────────────────────────────────
router.patch("/follow-ups/:id", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const { status, completedAt, description } = req.body;

    const followUp = await prisma.leadFollowUp.update({
      where: { id: req.params.id },
      data: {
        ...(status      !== undefined && { status }),
        ...(description !== undefined && { description }),
        ...(status === "COMPLETED"    && { completedAt: completedAt ? new Date(completedAt) : new Date() }),
      },
    });

    return res.status(200).json({ success: true, data: followUp });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update follow-up" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /leads/import/csv — Bulk CSV upload
// ────────────────────────────────────────────────────────────
/**
 * CSV required columns: firstName, phone
 * Optional: lastName, email, propertyType, budget, location, source, notes
 */
router.post("/leads/import/csv", verifyToken, validateOrgAccess, isOrgManager, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV file required" });
    }

    if (!req.file.originalname.endsWith(".csv")) {
      return res.status(400).json({ success: false, message: "Only .csv files accepted" });
    }

    // Create import job record first
    const job = await prisma.bulkImportJob.create({
      data: {
        organizationId: req.organizationId,
        uploadedById:   req.user.userId,
        fileName:       req.file.originalname,
        status:         "PROCESSING",
      },
    });

    // Parse CSV asynchronously (don't block response)
    res.status(202).json({ success: true, message: "Import started", data: { jobId: job.id } });

    // Background processing
    (async () => {
      const rows = [];
      const errors = [];

      try {
        await new Promise((resolve, reject) => {
          Readable.from(req.file.buffer.toString())
            .pipe(csvParser())
            .on("data", (row) => {
              if (rows.length < MAX_CSV_ROWS) rows.push(row);
            })
            .on("end", resolve)
            .on("error", reject);
        });

        await prisma.bulkImportJob.update({
          where: { id: job.id },
          data:  { totalRows: rows.length, startedAt: new Date() },
        });

        let successCount = 0;
        let failedCount  = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            // Validate required fields
            if (!row.firstName || !row.phone) {
              errors.push({ row: i + 2, error: "firstName and phone required" });
              failedCount++;
              continue;
            }

            // Check duplicate in org
            const dup = await prisma.lead.findFirst({
              where: { phone: row.phone, organizationId: req.organizationId, isActive: true },
            });

            if (dup) {
              errors.push({ row: i + 2, error: `Phone ${row.phone} already exists` });
              failedCount++;
              continue;
            }

            await prisma.lead.create({
              data: {
                organizationId: req.organizationId,
                firstName:      row.firstName?.trim(),
                lastName:       row.lastName?.trim() || "",
                phone:          row.phone?.trim(),
                email:          row.email?.trim() || null,
                propertyType:   row.propertyType  || null,
                budget:         row.budget ? parseFloat(row.budget) : null,
                location:       row.location?.trim() || null,
                source:         row.source || "CSV_IMPORT",
                notes:          row.notes?.trim() || null,
                assignedToId:   req.user.userId,
              },
            });

            successCount++;
          } catch (rowErr) {
            errors.push({ row: i + 2, error: rowErr.message });
            failedCount++;
          }
        }

        await prisma.bulkImportJob.update({
          where: { id: job.id },
          data: {
            status:       "COMPLETED",
            successCount,
            failedCount,
            errors:       errors.length > 0 ? errors : null,
            completedAt:  new Date(),
          },
        });

        console.log(`[LEAD] CSV import done — success:${successCount} failed:${failedCount}`);
      } catch (parseErr) {
        await prisma.bulkImportJob.update({
          where: { id: job.id },
          data:  { status: "FAILED", errors: [{ error: parseErr.message }] },
        });
      }
    })();
  } catch (err) {
    console.error("[LEAD] CSV import error:", err);
    return res.status(500).json({ success: false, message: "Failed to start import" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/import/jobs — Import job history
// ────────────────────────────────────────────────────────────
router.get("/leads/import/jobs", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const jobs = await prisma.bulkImportJob.findMany({
      where:   { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
      take:    20,
    });
    return res.status(200).json({ success: true, data: jobs });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch import jobs" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/import/jobs/:id — Single job status
// ────────────────────────────────────────────────────────────
router.get("/leads/import/jobs/:id", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const job = await prisma.bulkImportJob.findUnique({ where: { id: req.params.id } });
    if (!job || job.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    return res.status(200).json({ success: true, data: job });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch job" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/stats/overview — Dashboard counts
// ────────────────────────────────────────────────────────────
router.get("/leads/stats/overview", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);
    const baseWhere = {
      organizationId: req.organizationId,
      isActive:       true,
      ...(!canSeeAll && { assignedToId: req.user.userId }),
    };

    const [total, byStatus, byScore, bySource, thisMonth] = await Promise.all([
      prisma.lead.count({ where: baseWhere }),
      prisma.lead.groupBy({ by: ["status"], where: baseWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ["score"],  where: baseWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ["source"], where: baseWhere, _count: { id: true } }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: { total, byStatus, byScore, bySource, thisMonth },
    });
  } catch (err) {
    console.error("[LEAD] Stats overview error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/stats/pipeline — Pipeline funnel
// ────────────────────────────────────────────────────────────
router.get("/leads/stats/pipeline", verifyToken, validateOrgAccess, async (req, res) => {
  try {
    const pipeline = await prisma.lead.groupBy({
      by:    ["pipelineStage"],
      where: { organizationId: req.organizationId, isActive: true },
      _count: { id: true },
    });

    return res.status(200).json({ success: true, data: pipeline });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch pipeline stats" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /leads/stats/agent — Per-agent performance
// ────────────────────────────────────────────────────────────
router.get("/leads/stats/agent", verifyToken, validateOrgAccess, isOrgManager, async (req, res) => {
  try {
    const stats = await prisma.lead.groupBy({
      by:    ["assignedToId"],
      where: { organizationId: req.organizationId, isActive: true },
      _count: { id: true },
    });

    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch agent stats" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /admin/leads — All leads across orgs (Platform Admin)
// ────────────────────────────────────────────────────────────
router.get("/admin/leads", verifyToken, isPlatformAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, organizationId, status } = req.query;

    const where = {
      isActive: true,
      ...(organizationId && { organizationId }),
      ...(status         && { status }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip:    (Number(page) - 1) * Number(limit),
        take:    Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.count({ where }),
    ]);

    return res.status(200).json({ success: true, data: leads, meta: { total, page: Number(page) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
});

// ============================================================
// 🔒  INTERNAL ROUTES
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /internal/facebook-webhook — Facebook Lead Ads
// ────────────────────────────────────────────────────────────
/**
 * Facebook sends lead data here when a Facebook Lead Ad form is submitted.
 * Verify webhook secret per org, then create lead automatically.
 */
router.post("/internal/facebook-webhook", async (req, res) => {
  try {
    const { organizationId, leadData } = req.body;

    // Verify this org has Facebook integration configured
    const config = await prisma.leadSourceConfig.findFirst({
      where: { organizationId, source: "FACEBOOK_ADS", isActive: true },
    });

    if (!config) {
      return res.status(403).json({ success: false, message: "Facebook integration not configured" });
    }

    // Parse Facebook lead fields
    const fields = leadData?.field_data || [];
    const getField = (name) => fields.find((f) => f.name === name)?.values?.[0] || null;

    const phone = getField("phone_number") || getField("phone");
    const email = getField("email");
    const firstName = getField("first_name") || getField("full_name")?.split(" ")[0] || "Unknown";

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number missing in Facebook lead" });
    }

    // Deduplicate
    const existing = await prisma.lead.findFirst({
      where: { phone, organizationId, isActive: true },
    });

    if (existing) {
      return res.status(200).json({ success: true, message: "Duplicate lead — skipped", data: { leadId: existing.id } });
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId,
        firstName,
        phone,
        email,
        source:       "FACEBOOK_ADS",
        facebookLeadId: leadData?.leadgen_id || null,
      },
    });

    console.log("[LEAD] Facebook lead created:", lead.id);
    return res.status(201).json({ success: true, data: lead });
  } catch (err) {
    console.error("[LEAD] Facebook webhook error:", err);
    return res.status(500).json({ success: false, message: "Failed to process Facebook lead" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/update-ai-insights — Called by Calling Service
// ────────────────────────────────────────────────────────────
/**
 * After an AI call completes, Calling Service sends extracted
 * insights here to update the lead record.
 *
 * Body: { leadId, sentiment, buyingIntent, aiSummary, aiExtracted,
 *         suggestedScore, extractedBudget, extractedLocation }
 */
router.post("/internal/update-ai-insights", async (req, res) => {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const {
      leadId, sentiment, buyingIntent, aiSummary,
      aiExtracted, suggestedScore,
    } = req.body;

    if (!leadId) return res.status(400).json({ success: false, message: "leadId required" });

    const updateData = {
      ...(sentiment    && { aiSentiment: sentiment }),
      ...(buyingIntent && { aiBuyingIntent: buyingIntent }),
      ...(aiSummary    && { aiSummary }),
      ...(aiExtracted  && { aiExtracted }),
      ...(suggestedScore && { score: suggestedScore }),
      lastContactedAt: new Date(),
    };

    const updated = await prisma.lead.update({ where: { id: leadId }, data: updateData });

    await logActivity(leadId, "SYSTEM", "AI_CALL", "AI call insights updated", aiSummary || null, { sentiment, buyingIntent, suggestedScore });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[LEAD] AI insights update error:", err);
    return res.status(500).json({ success: false, message: "Failed to update AI insights" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/log-call — Called by Calling Service
// ────────────────────────────────────────────────────────────
/**
 * Calling Service calls this after every call to create a LeadCall
 * reference and update lastContactedAt on the lead.
 *
 * Body: { leadId, callId, isAiCall, initiatedById, duration,
 *         outcome, recordingUrl, summary }
 */
router.post("/internal/log-call", async (req, res) => {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { leadId, callId, isAiCall, initiatedById, duration, outcome, recordingUrl, summary } = req.body;

    if (!leadId || !callId) {
      return res.status(400).json({ success: false, message: "leadId and callId required" });
    }

    // Upsert so Calling Service can safely retry
    const leadCall = await prisma.leadCall.upsert({
      where:  { callId },
      create: { leadId, callId, isAiCall: isAiCall || false, initiatedById: initiatedById || null, duration: duration || null, outcome: outcome || null, recordingUrl: recordingUrl || null, summary: summary || null },
      update: { duration, outcome, recordingUrl, summary },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data:  { lastContactedAt: new Date() },
    });

    await logActivity(leadId, initiatedById || "SYSTEM", isAiCall ? "AI_CALL" : "CALL_MADE", `Call ${outcome || "completed"} — ${duration || 0}s`, summary || null, { callId, duration, outcome });

    return res.status(201).json({ success: true, data: leadCall });
  } catch (err) {
    console.error("[LEAD] Log call error:", err);
    return res.status(500).json({ success: false, message: "Failed to log call" });
  }
});

export default router;