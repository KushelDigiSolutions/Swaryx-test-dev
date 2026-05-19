import express from "express";
import jwt from "jsonwebtoken"
import prisma from "../../utils/prisma.js";

const router = express.Router();
// const prisma = new PrismaClient();

//////////////////////////////////////
// 🔐 VERIFY TOKEN
//////////////////////////////////////

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

//////////////////////////////////////
// 🟢 CREATE PLAN (SUPER ADMIN ONLY)
//////////////////////////////////////

router.post("/plan", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Only super admin allowed" });
    }

    const { name, priceMonthly, priceYearly, userLimit } = req.body;

    const plan = await prisma.plan.create({
      data: {
        name,
        priceMonthly,
        priceYearly,
        userLimit,
      },
    });

    res.status(201).json({
      message: "Plan created",
      plan,
    });
  } catch (error) {
    res.status(500).json({ message: "Plan creation failed" });
  }
});

//////////////////////////////////////
// 📋 GET ALL PLANS
//////////////////////////////////////

router.get("/plans", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
    });

    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

//////////////////////////////////////
// 💳 CREATE SUBSCRIPTION
//////////////////////////////////////

router.post("/subscribe", verifyToken, async (req, res) => {
  try {
    const { orgId, planId } = req.body;

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const subscription = await prisma.subscription.create({
      data: {
        orgId,
        planId,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: null,
      },
    });

    res.status(201).json({
      message: "Subscription created",
      subscription,
    });
  } catch (error) {
    res.status(500).json({ message: "Subscription failed" });
  }
});

//////////////////////////////////////
// 📊 GET ORG SUBSCRIPTION
//////////////////////////////////////

router.get("/subscription/:orgId", verifyToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        orgId: req.params.orgId,
        status: "ACTIVE",
      },
    });

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

//////////////////////////////////////
// 🔄 CANCEL SUBSCRIPTION
//////////////////////////////////////

router.post("/cancel", verifyToken, async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELLED",
        endDate: new Date(),
      },
    });

    res.json({
      message: "Subscription cancelled",
      updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Cancel failed" });
  }
});

//////////////////////////////////////
// 🔍 CHECK USER LIMIT (IMPORTANT 🔥)
//////////////////////////////////////

router.get("/check-limit/:orgId", verifyToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        orgId: req.params.orgId,
        status: "ACTIVE",
      },
    });

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription" });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: subscription.planId },
    });

    return res.json({
      userLimit: plan.userLimit,
    });
  } catch (error) {
    res.status(500).json({ message: "Limit check failed" });
  }
});

export default router;