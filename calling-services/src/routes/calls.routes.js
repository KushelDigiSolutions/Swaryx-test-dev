/**
 * ============================================================
 * 📞 CALLING SERVICE — routes.js
 * ============================================================
 *
 * Call Routes:
 *  POST   /calls                          → Initiate manual call
 *  GET    /calls                          → List calls (paginated)
 *  GET    /calls/:id                      → Single call detail
 *  POST   /calls/:id/end                  → End active call
 *  GET    /calls/:id/recording            → Get recording URL
 *  GET    /calls/:id/transcript           → Get transcription
 *  GET    /calls/:id/analysis             → Get AI analysis
 *
 * AI Call Routes:
 *  POST   /ai-calls/trigger               → Trigger single AI call
 *  POST   /ai-calls/schedule              → Schedule AI call for later
 *
 * Campaign Routes:
 *  POST   /campaigns                      → Create campaign
 *  GET    /campaigns                      → List campaigns
 *  GET    /campaigns/:id                  → Single campaign
 *  POST   /campaigns/:id/start            → Start campaign
 *  POST   /campaigns/:id/pause            → Pause campaign
 *  POST   /campaigns/:id/cancel           → Cancel campaign
 *  GET    /campaigns/:id/stats            → Campaign performance
 *
 * Script Routes:
 *  POST   /scripts                        → Create AI script
 *  GET    /scripts                        → List scripts
 *  GET    /scripts/:id                    → Single script
 *  PATCH  /scripts/:id                    → Update script
 *  DELETE /scripts/:id                    → Delete script
 *
 * Appointment Routes:
 *  GET    /appointments                   → List appointments
 *  GET    /appointments/:id               → Single appointment
 *  PATCH  /appointments/:id               → Update appointment
 *  POST   /appointments/:id/complete      → Mark completed
 *  POST   /appointments/:id/cancel        → Cancel
 *
 * Dashboard Routes:
 *  GET    /stats/overview                 → Call counts by status/type
 *  GET    /stats/performance              → Answer rate, avg duration, etc.
 *  GET    /stats/agent                    → Per-agent call stats
 *
 * Webhook Routes (Twilio/Plivo callbacks):
 *  POST   /webhooks/call-status           → Call status updates
 *  POST   /webhooks/recording-complete    → Recording ready
 *  POST   /webhooks/transcription-complete → Transcription ready
 *  GET    /webhooks/ai-voice-response     → AI TwiML/PHLO response
 *
 * Internal Routes:
 *  POST   /internal/trigger-ai-call       → Called by Lead Service / Campaign scheduler
 * ============================================================
 */

import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import twilio from "twilio";
import prisma from "../../utils/prisma.js";

const router = express.Router();

// ============================================================
// ⚙️  CONSTANTS
// ============================================================

const CALL_TIMEOUT_SECS = 30;  // Ring timeout before no-answer

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
const isOrgManager = requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER");

/**
 * loadOrgContext
 * --------------
 * Fetches organizationId for the caller from User Service.
 * Attaches req.organizationId for all protected routes.
 */
const loadOrgContext = async (req, res, next) => {
  try {
    if (["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user?.role)) return next();

    const resp = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/users/internal/${req.user.userId}`,
      { headers: internalHeaders(req.headers.authorization), timeout: 5000 }
    );
    req.organizationId = resp.data?.data?.organizationId;

    if (!req.organizationId) {
      return res.status(403).json({ success: false, message: "You don't belong to any organization" });
    }
    next();
  } catch (err) {
    console.error("[CALL] loadOrgContext error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load organization context" });
  }
};

// ============================================================
// 🌐  HELPERS
// ============================================================

const internalHeaders = (authHeader) => ({
  Authorization: authHeader,
  "x-internal-secret": process.env.INTERNAL_SECRET,
});

/**
 * getTwilioClient
 * ---------------
 * Returns a Twilio client for the given organization.
 * Reads per-org credentials from CallProviderConfig.
 * Falls back to platform-level Twilio credentials if not configured.
 */
const getTwilioClient = async (organizationId) => {
  const config = await prisma.callProviderConfig.findUnique({
    where: { organizationId },
  });

  const accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }

  return {
    client: twilio(accountSid, authToken),
    fromNumber: config?.phoneNumber || process.env.TWILIO_FROM_NUMBER,
    webhookBase: config?.webhookBase || process.env.WEBHOOK_BASE_URL,
  };
};

/**
 * notifyAgent
 * -----------
 * Fire-and-forget in-app notification to an agent.
 */
const notifyAgent = async (authHeader, userId, title, body, priority = "NORMAL") => {
  try {
    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/internal/send`,
      { userId, title, body, type: "IN_APP", priority },
      { headers: internalHeaders(authHeader), timeout: 5000 }
    );
  } catch (err) {
    console.error("[CALL] notifyAgent error:", err.message);
  }
};

/**
 * syncCallToLeadService
 * ----------------------
 * After a call ends, push call log to Lead Service.
 * Fire-and-forget.
 */
const syncCallToLeadService = async (call) => {
  try {
    await axios.post(
      `${process.env.LEAD_SERVICE_URL}/api/leads/internal/log-call`,
      {
        leadId: call.leadId,
        callId: call.id,
        isAiCall: call.isAiCall,
        initiatedById: call.initiatedById,
        duration: call.duration,
        outcome: call.outcome,
        recordingUrl: call.recordingUrl,
        summary: call.aiAnalysis?.aiSummary || null,
      },
      {
        headers: { "x-internal-secret": process.env.INTERNAL_SECRET },
        timeout: 5000,
      }
    );
  } catch (err) {
    console.error("[CALL] syncCallToLeadService error:", err.message);
  }
};

/**
 * pushAiInsightsToLeadService
 * ----------------------------
 * After AI analysis is complete, push insights to Lead Service
 * so the lead record gets updated score, sentiment, etc.
 */
const pushAiInsightsToLeadService = async (analysis) => {
  try {
    await axios.post(
      `${process.env.LEAD_SERVICE_URL}/api/leads/internal/update-ai-insights`,
      {
        leadId: analysis.leadId,
        sentiment: analysis.sentiment,
        buyingIntent: analysis.buyingIntent,
        aiSummary: analysis.aiSummary,
        aiExtracted: {
          budget: analysis.extractedBudget,
          location: analysis.extractedLocation,
          timeline: analysis.extractedTimeline,
          bhk: analysis.extractedBhk,
        },
        suggestedScore: analysis.suggestedScore,
      },
      {
        headers: { "x-internal-secret": process.env.INTERNAL_SECRET },
        timeout: 5000,
      }
    );
  } catch (err) {
    console.error("[CALL] pushAiInsightsToLeadService error:", err.message);
  }
};

// ============================================================
// ============================================================
// 📌  ROUTES
// ============================================================
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /calls — Initiate a manual call
// ────────────────────────────────────────────────────────────
/**
 * Agent manually triggers a call to a lead.
 *
 * Body: { leadId, toNumber, scriptId? }
 *
 * Flow:
 *  1. Create Call record (status: QUEUED)
 *  2. Dial via Twilio
 *  3. Update record with providerCallId
 *  4. Twilio sends status updates to /webhooks/call-status
 */
router.post("/calls", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const { leadId, toNumber, scriptId } = req.body;

    if (!leadId || !toNumber) {
      return res.status(400).json({ success: false, message: "leadId and toNumber required" });
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        organizationId: req.organizationId,
        leadId,
        initiatedById: req.user.userId,
        isAiCall: false,
        type: "MANUAL",
        direction: "OUTBOUND",
        fromNumber: "pending",       // set after Twilio responds
        toNumber,
        status: "QUEUED",
        scriptId: scriptId || null,
      },
    });

    // Initiate via Twilio
    try {
      const { client, fromNumber, webhookBase } = await getTwilioClient(req.organizationId);

      const twilioCall = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${webhookBase}/api/calling/webhooks/ai-voice-response?callId=${call.id}`,
        statusCallback: `${webhookBase}/api/calling/webhooks/call-status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        timeout: CALL_TIMEOUT_SECS,
        record: true,
        recordingStatusCallback: `${webhookBase}/api/calling/webhooks/recording-complete`,
      });

      // Update call with Twilio CallSid
      await prisma.call.update({
        where: { id: call.id },
        data: {
          providerCallId: twilioCall.sid,
          fromNumber,
          status: "INITIATED",
        },
      });

      console.log("[CALL] Manual call initiated ✅ →", toNumber, "| SID:", twilioCall.sid);

      return res.status(201).json({
        success: true,
        data: { callId: call.id, providerCallId: twilioCall.sid, status: "INITIATED" },
      });
    } catch (twilioErr) {
      // Mark call as failed if Twilio errors out
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "FAILED" },
      });

      console.error("[CALL] Twilio dial error:", twilioErr.message);
      return res.status(502).json({ success: false, message: `Call failed: ${twilioErr.message}` });
    }
  } catch (err) {
    console.error("[CALL] Initiate call error:", err);
    return res.status(500).json({ success: false, message: "Failed to initiate call" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /calls — List calls (paginated + filters)
// ────────────────────────────────────────────────────────────
router.get("/calls", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, type, leadId, isAiCall,
      dateFrom, dateTo,
    } = req.query;

    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);

    const where = {
      organizationId: req.organizationId,
      ...(!canSeeAll && { initiatedById: req.user.userId }),
      ...(status && { status }),
      ...(type && { type }),
      ...(leadId && { leadId }),
      ...(isAiCall !== undefined && { isAiCall: isAiCall === "true" }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          aiAnalysis: { select: { sentiment: true, buyingIntent: true, aiSummary: true, suggestedScore: true } },
          transcription: { select: { status: true } },
        },
      }),
      prisma.call.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: calls,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    console.error("[CALL] List error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch calls" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /calls/:id — Single call detail
// ────────────────────────────────────────────────────────────
router.get("/calls/:id", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: { transcription: true, aiAnalysis: true, appointment: true },
    });

    if (!call || call.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    return res.status(200).json({ success: true, data: call });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch call" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /calls/:id/transcript — Full conversation transcript
// ────────────────────────────────────────────────────────────
router.get("/calls/:id/transcript", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const transcript = await prisma.callTranscription.findUnique({
      where: { callId: req.params.id },
    });

    if (!transcript) {
      return res.status(404).json({ success: false, message: "Transcription not available yet" });
    }

    return res.status(200).json({ success: true, data: transcript });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch transcript" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /calls/:id/analysis — AI insights for a call
// ────────────────────────────────────────────────────────────
router.get("/calls/:id/analysis", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const analysis = await prisma.callAiAnalysis.findUnique({
      where: { callId: req.params.id },
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: "AI analysis not available yet" });
    }

    return res.status(200).json({ success: true, data: analysis });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch analysis" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /ai-calls/trigger — Trigger single AI call now
// ────────────────────────────────────────────────────────────
/**
 * Immediately trigger an AI outbound call to a lead.
 *
 * Body: { leadId, toNumber, scriptId? }
 *
 * AI call flow:
 *  1. Create Call record (isAiCall: true)
 *  2. Dial via Twilio
 *  3. Twilio fetches TwiML from /webhooks/ai-voice-response
 *  4. TwiML connects the call to your AI voice agent (Twilio Conversations / ElevenLabs etc.)
 *  5. After call ends, Twilio POSTs to /webhooks/call-status
 */
router.post("/ai-calls/trigger", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const { leadId, toNumber, scriptId } = req.body;

    if (!leadId || !toNumber) {
      return res.status(400).json({ success: false, message: "leadId and toNumber required" });
    }

    const call = await prisma.call.create({
      data: {
        organizationId: req.organizationId,
        leadId,
        initiatedById: req.user.userId,
        isAiCall: true,
        type: "AI_OUTBOUND",
        direction: "OUTBOUND",
        fromNumber: "pending",
        toNumber,
        status: "QUEUED",
        scriptId: scriptId || null,
      },
    });

    try {
      const { client, fromNumber, webhookBase } = await getTwilioClient(req.organizationId);

      const twilioCall = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${webhookBase}/api/calling/webhooks/ai-voice-response?callId=${call.id}&isAi=true`,
        statusCallback: `${webhookBase}/api/calling/webhooks/call-status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        timeout: CALL_TIMEOUT_SECS,
        record: true,
        recordingStatusCallback: `${webhookBase}/api/calling/webhooks/recording-complete`,
      });

      await prisma.call.update({
        where: { id: call.id },
        data: { providerCallId: twilioCall.sid, fromNumber, status: "INITIATED" },
      });

      console.log("[CALL] AI call initiated ✅ →", toNumber, "| SID:", twilioCall.sid);

      return res.status(201).json({
        success: true,
        data: { callId: call.id, providerCallId: twilioCall.sid, status: "INITIATED" },
      });
    } catch (twilioErr) {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "FAILED" },
      });
      return res.status(502).json({ success: false, message: `AI call failed: ${twilioErr.message}` });
    }
  } catch (err) {
    console.error("[CALL] AI trigger error:", err);
    return res.status(500).json({ success: false, message: "Failed to trigger AI call" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /ai-calls/schedule — Schedule AI call for later
// ────────────────────────────────────────────────────────────
router.post("/ai-calls/schedule", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const { leadId, toNumber, scriptId, scheduledAt } = req.body;

    if (!leadId || !toNumber || !scheduledAt) {
      return res.status(400).json({ success: false, message: "leadId, toNumber and scheduledAt required" });
    }

    // Create a call queue entry (picked up by a cron/worker)
    const queued = await prisma.callQueue.create({
      data: {
        organizationId: req.organizationId,
        leadId,
        scriptId: scriptId || null,
        toNumber,
        scheduledAt: new Date(scheduledAt),
        maxAttempts: 3,
      },
    });

    return res.status(201).json({
      success: true,
      message: "AI call scheduled",
      data: { queueId: queued.id, scheduledAt: queued.scheduledAt },
    });
  } catch (err) {
    console.error("[CALL] Schedule AI call error:", err);
    return res.status(500).json({ success: false, message: "Failed to schedule call" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /campaigns — Create a call campaign
// ────────────────────────────────────────────────────────────
/**
 * Body: { name, description?, scriptId?, leadIds[], scheduledAt?,
 *         callBetweenStart?, callBetweenEnd?, maxCallDuration?,
 *         retryCount?, retryAfterMins? }
 */
router.post("/campaigns", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const {
      name, description, scriptId, leadIds,
      scheduledAt, callBetweenStart, callBetweenEnd,
      maxCallDuration, retryCount, retryAfterMins,
    } = req.body;

    if (!name || !leadIds?.length) {
      return res.status(400).json({ success: false, message: "name and leadIds required" });
    }

    if (leadIds.length > 500) {
      return res.status(400).json({ success: false, message: "Maximum 500 leads per campaign" });
    }

    const campaign = await prisma.callCampaign.create({
      data: {
        organizationId: req.organizationId,
        name,
        description: description || null,
        scriptId: scriptId || null,
        leadIds: leadIds,
        totalLeads: leadIds.length,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        callBetweenStart: callBetweenStart || "09:00",
        callBetweenEnd: callBetweenEnd || "18:00",
        maxCallDuration: maxCallDuration || 300,
        retryCount: retryCount || 1,
        retryAfterMins: retryAfterMins || 60,
        createdById: req.user.userId,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
      },
    });

    return res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    console.error("[CALL] Create campaign error:", err);
    return res.status(500).json({ success: false, message: "Failed to create campaign" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /campaigns — List campaigns
// ────────────────────────────────────────────────────────────
router.get("/campaigns", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const where = {
      organizationId: req.organizationId,
      ...(status && { status }),
    };

    const [campaigns, total] = await Promise.all([
      prisma.callCampaign.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.callCampaign.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: campaigns,
      meta: { total, page: Number(page) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch campaigns" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /campaigns/:id/start — Start a campaign
// ────────────────────────────────────────────────────────────
/**
 * Enqueues all leads in the campaign into CallQueue.
 * A background worker (cron job / Bull queue) picks them up.
 */
router.post("/campaigns/:id/start", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const campaign = await prisma.callCampaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    if (!["DRAFT", "SCHEDULED", "PAUSED"].includes(campaign.status)) {
      return res.status(400).json({ success: false, message: `Cannot start a ${campaign.status} campaign` });
    }

    // Fetch phone numbers for all leads in campaign
    const leadIds = campaign.leadIds;

    // Enqueue all leads into CallQueue
    // In production: use Bull/BullMQ to add jobs instead of DB queue
    const queueEntries = leadIds.map((leadId) => ({
      organizationId: req.organizationId,
      leadId,
      campaignId: campaign.id,
      scriptId: campaign.scriptId,
      toNumber: "RESOLVE_FROM_LEAD", // Worker resolves phone from Lead Service
      scheduledAt: new Date(),
    }));

    // Bulk create queue entries in batches of 50
    for (let i = 0; i < queueEntries.length; i += 50) {
      await prisma.callQueue.createMany({
        data: queueEntries.slice(i, i + 50),
        skipDuplicates: true,
      });
    }

    await prisma.callCampaign.update({
      where: { id: campaign.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    console.log(`[CALL] Campaign ${campaign.id} started — ${leadIds.length} leads queued`);

    return res.status(200).json({
      success: true,
      message: `Campaign started — ${leadIds.length} calls queued`,
      data: { campaignId: campaign.id, queuedCount: leadIds.length },
    });
  } catch (err) {
    console.error("[CALL] Start campaign error:", err);
    return res.status(500).json({ success: false, message: "Failed to start campaign" });
  }
});

// ────────────────────────────────────────────────────────────
// POST /campaigns/:id/pause — Pause a running campaign
// ────────────────────────────────────────────────────────────
router.post("/campaigns/:id/pause", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const campaign = await prisma.callCampaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    if (campaign.status !== "RUNNING") {
      return res.status(400).json({ success: false, message: "Only running campaigns can be paused" });
    }

    await prisma.callCampaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    });

    return res.status(200).json({ success: true, message: "Campaign paused" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to pause campaign" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /campaigns/:id/stats — Campaign performance
// ────────────────────────────────────────────────────────────
router.get("/campaigns/:id/stats", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const campaign = await prisma.callCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign || campaign.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const callStats = await prisma.call.groupBy({
      by: ["status", "outcome"],
      where: { campaignId: req.params.id },
      _count: { id: true },
    });

    const totalCalls = await prisma.call.count({ where: { campaignId: req.params.id } });
    const answered = callStats.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s._count.id, 0);
    const answerRate = totalCalls > 0 ? ((answered / totalCalls) * 100).toFixed(1) : 0;

    const avgDuration = await prisma.call.aggregate({
      where: { campaignId: req.params.id, status: "COMPLETED" },
      _avg: { duration: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        campaign,
        stats: {
          totalLeads: campaign.totalLeads,
          calledCount: campaign.calledCount,
          answeredCount: answered,
          answerRate: `${answerRate}%`,
          avgDuration: `${Math.round(avgDuration._avg.duration || 0)}s`,
          byOutcome: callStats,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch campaign stats" });
  }
});

// ────────────────────────────────────────────────────────────
// SCRIPT ROUTES
// ────────────────────────────────────────────────────────────

// POST /scripts
router.post("/scripts", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const { name, type, language, opening, qualification, closing, objectionHandlers } = req.body;

    if (!name || !opening) {
      return res.status(400).json({ success: false, message: "name and opening required" });
    }

    const script = await prisma.callScript.create({
      data: {
        organizationId: req.organizationId,
        name, type: type || "INTRODUCTION",
        language: language || "en",
        opening,
        qualification: qualification || null,
        closing: closing || null,
        objectionHandlers: objectionHandlers || null,
        createdById: req.user.userId,
      },
    });

    return res.status(201).json({ success: true, data: script });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to create script" });
  }
});

// GET /scripts
router.get("/scripts", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const scripts = await prisma.callScript.findMany({
      where: { organizationId: req.organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, data: scripts });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch scripts" });
  }
});

// PATCH /scripts/:id
router.patch("/scripts/:id", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const { name, opening, qualification, closing, objectionHandlers, isActive } = req.body;

    const updated = await prisma.callScript.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(opening !== undefined && { opening }),
        ...(qualification !== undefined && { qualification }),
        ...(closing !== undefined && { closing }),
        ...(objectionHandlers !== undefined && { objectionHandlers }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update script" });
  }
});

// ────────────────────────────────────────────────────────────
// APPOINTMENT ROUTES
// ────────────────────────────────────────────────────────────

// GET /appointments
router.get("/appointments", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);

    const where = {
      organizationId: req.organizationId,
      ...(!canSeeAll && { assignedToId: req.user.userId }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        scheduledAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.appointment.count({ where }),
    ]);

    return res.status(200).json({ success: true, data: appointments, meta: { total, page: Number(page) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch appointments" });
  }
});

// PATCH /appointments/:id
router.patch("/appointments/:id", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const { scheduledAt, location, notes, assignedToId, status } = req.body;

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(status !== undefined && { status }),
        ...(status === "COMPLETED" && { completedAt: new Date() }),
        ...(status === "CANCELLED" && { cancelledAt: new Date() }),
      },
    });

    // Notify assigned agent on rescheduling
    if (assignedToId) {
      notifyAgent(
        req.headers.authorization,
        assignedToId,
        "Appointment Assigned",
        `You have a site visit scheduled on ${scheduledAt ? new Date(scheduledAt).toDateString() : "—"}.`,
        "HIGH"
      );
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update appointment" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /stats/overview — Call dashboard
// ────────────────────────────────────────────────────────────
router.get("/stats/overview", verifyToken, loadOrgContext, async (req, res) => {
  try {
    const canSeeAll = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ORG_ADMIN", "ORG_MANAGER"].includes(req.user.role);
    const baseWhere = {
      organizationId: req.organizationId,
      ...(!canSeeAll && { initiatedById: req.user.userId }),
    };

    const [total, byStatus, byType, byOutcome, todayCalls, avgDuration] = await Promise.all([
      prisma.call.count({ where: baseWhere }),
      prisma.call.groupBy({ by: ["status"], where: baseWhere, _count: { id: true } }),
      prisma.call.groupBy({ by: ["type"], where: baseWhere, _count: { id: true } }),
      prisma.call.groupBy({ by: ["outcome"], where: { ...baseWhere, outcome: { not: null } }, _count: { id: true } }),
      prisma.call.count({
        where: { ...baseWhere, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.call.aggregate({ where: { ...baseWhere, status: "COMPLETED" }, _avg: { duration: true } }),
    ]);

    const completed = byStatus.find((s) => s.status === "COMPLETED")?._count.id || 0;
    const answerRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      data: {
        total, byStatus, byType, byOutcome, todayCalls,
        answerRate: `${answerRate}%`,
        avgDuration: `${Math.round(avgDuration._avg.duration || 0)}s`,
      },
    });
  } catch (err) {
    console.error("[CALL] Stats overview error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

// GET /stats/agent — Per-agent call stats
router.get("/stats/agent", verifyToken, loadOrgContext, isOrgManager, async (req, res) => {
  try {
    const [callsByAgent, durationByAgent] = await Promise.all([
      prisma.call.groupBy({
        by: ["initiatedById", "status"],
        where: { organizationId: req.organizationId, isAiCall: false },
        _count: { id: true },
      }),
      prisma.call.groupBy({
        by: ["initiatedById"],
        where: { organizationId: req.organizationId, isAiCall: false, status: "COMPLETED" },
        _avg: { duration: true },
        _sum: { duration: true },
      }),
    ]);

    return res.status(200).json({ success: true, data: { callsByAgent, durationByAgent } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch agent stats" });
  }
});

// ============================================================
// 🔔  TWILIO WEBHOOKS
// ============================================================

// ────────────────────────────────────────────────────────────
// POST /webhooks/call-status — Twilio status callback
// ────────────────────────────────────────────────────────────
/**
 * Twilio calls this on every status change:
 * initiated → ringing → answered → completed
 *
 * Maps Twilio statuses to our CallStatus enum.
 * On "completed": calculates duration, syncs to Lead Service.
 */
router.post("/webhooks/call-status", async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    if (!CallSid) return res.status(400).send("CallSid required");

    // Map Twilio status to our enum
    const statusMap = {
      "initiated": "INITIATED",
      "ringing": "RINGING",
      "in-progress": "IN_PROGRESS",
      "completed": "COMPLETED",
      "busy": "BUSY",
      "no-answer": "NO_ANSWER",
      "failed": "FAILED",
      "canceled": "CANCELLED",
    };

    const mappedStatus = statusMap[CallStatus] || "FAILED";

    const call = await prisma.call.findFirst({ where: { providerCallId: CallSid } });

    if (!call) {
      console.warn("[CALL] Webhook: call not found for SID:", CallSid);
      return res.status(200).send("OK");
    }

    const updateData = {
      status: mappedStatus,
      ...(mappedStatus === "IN_PROGRESS" && { startedAt: new Date() }),
      ...(mappedStatus === "COMPLETED" && {
        endedAt: new Date(),
        duration: CallDuration ? parseInt(CallDuration) : null,
        outcome: "ANSWERED_POSITIVE", // Will be refined after AI analysis
      }),
    };

    const updated = await prisma.call.update({
      where: { id: call.id },
      data: updateData,
    });

    // On completion: sync to Lead Service + trigger AI analysis
    if (mappedStatus === "COMPLETED") {
      syncCallToLeadService(updated);

      // If it was an AI call, trigger post-call AI analysis
      if (call.isAiCall) {
        // In production: push to a queue (Bull/BullMQ)
        // For now: async processing placeholder
        console.log("[CALL] AI call completed — AI analysis will process when transcription is ready");
      }
    }

    console.log("[CALL] Status updated:", CallSid, "→", mappedStatus);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("[CALL] Webhook call-status error:", err);
    return res.status(500).send("Error");
  }
});

// ────────────────────────────────────────────────────────────
// POST /webhooks/recording-complete — Twilio recording ready
// ────────────────────────────────────────────────────────────
router.post("/webhooks/recording-complete", async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingStatus, RecordingDuration } = req.body;

    if (!CallSid || !RecordingUrl) return res.status(400).send("Missing data");

    const call = await prisma.call.findFirst({ where: { providerCallId: CallSid } });
    if (!call) return res.status(200).send("OK");

    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingUrl: `${RecordingUrl}.mp3`, // Twilio appends .mp3 for downloadable URL
        recordingStatus: RecordingStatus || "completed",
      },
    });

    // Create transcription job
    await prisma.callTranscription.upsert({
      where: { callId: call.id },
      create: { callId: call.id, status: "pending" },
      update: { status: "pending" },
    });

    // TODO: Send to transcription provider (Deepgram / AWS Transcribe)
    // deepgramClient.transcribeUrl({ url: RecordingUrl })
    console.log("[CALL] Recording ready for call:", call.id);

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[CALL] Recording webhook error:", err);
    return res.status(500).send("Error");
  }
});

// ────────────────────────────────────────────────────────────
// GET /webhooks/ai-voice-response — Returns TwiML for AI call
// ────────────────────────────────────────────────────────────
/**
 * Twilio fetches this URL when an AI call connects.
 * Returns TwiML XML that connects to your AI voice agent.
 *
 * For production: replace the <Say> with a <Connect> to
 * Twilio Conversations / ElevenLabs / your custom AI stream.
 */
router.get("/webhooks/ai-voice-response", async (req, res) => {
  try {
    const { callId, isAi } = req.query;

    // Fetch call and its script
    const call = callId ? await prisma.call.findUnique({
      where: { id: callId },
      include: { script: true },
    }) : null;

    const openingLine = call?.script?.opening
      || "Hello, this is an automated call from our real estate team. I'd like to discuss a property that matches your requirements. Do you have a moment to talk?";

    // Build TwiML
    // In production: use <Connect><Stream url="wss://..."/> for live AI
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">${openingLine}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/calling/webhooks/ai-voice-response/gather?callId=${callId}">
    <Say voice="Polly.Aditi" language="en-IN">Please tell me your requirements.</Say>
  </Gather>
  <Say voice="Polly.Aditi">Thank you for your time. We will follow up with you shortly. Have a great day!</Say>
</Response>`;

    res.set("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err) {
    console.error("[CALL] TwiML generation error:", err);
    // Return a safe fallback TwiML
    res.set("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for your time. Goodbye.</Say></Response>`);
  }
});

// ────────────────────────────────────────────────────────────
// POST /internal/trigger-ai-call — Internal call trigger
// ────────────────────────────────────────────────────────────
/**
 * Called by campaign worker / Lead Service to trigger an AI call.
 * Does NOT require JWT — uses x-internal-secret.
 *
 * Body: { organizationId, leadId, toNumber, scriptId? }
 */
router.post("/internal/trigger-ai-call", async (req, res) => {
  try {
    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { organizationId, leadId, toNumber, scriptId, campaignId } = req.body;

    if (!organizationId || !leadId || !toNumber) {
      return res.status(400).json({ success: false, message: "organizationId, leadId and toNumber required" });
    }

    const call = await prisma.call.create({
      data: {
        organizationId,
        leadId,
        campaignId: campaignId || null,
        isAiCall: true,
        type: "AI_OUTBOUND",
        direction: "OUTBOUND",
        fromNumber: "pending",
        toNumber,
        status: "QUEUED",
        scriptId: scriptId || null,
      },
    });

    try {
      const { client, fromNumber, webhookBase } = await getTwilioClient(organizationId);

      const twilioCall = await client.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${webhookBase}/api/calling/webhooks/ai-voice-response?callId=${call.id}&isAi=true`,
        statusCallback: `${webhookBase}/api/calling/webhooks/call-status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        timeout: CALL_TIMEOUT_SECS,
        record: true,
        recordingStatusCallback: `${webhookBase}/api/calling/webhooks/recording-complete`,
      });

      await prisma.call.update({
        where: { id: call.id },
        data: { providerCallId: twilioCall.sid, fromNumber, status: "INITIATED" },
      });

      console.log("[CALL] Internal AI call triggered ✅ →", toNumber);

      return res.status(201).json({
        success: true,
        data: { callId: call.id, providerCallId: twilioCall.sid },
      });
    } catch (twilioErr) {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "FAILED" },
      });
      return res.status(502).json({ success: false, message: `Twilio error: ${twilioErr.message}` });
    }
  } catch (err) {
    console.error("[CALL] Internal trigger error:", err);
    return res.status(500).json({ success: false, message: "Failed to trigger AI call" });
  }
});

export default router;