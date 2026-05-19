import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";

// ── Plans manage karna ──────────────────────────

// Naya plan banao
export const createPlan = async (req, res) => {
  try {
    const { name, planType, userLimit, price, durationDays, features } = req.body;

    const plan = await prisma.plan.create({
      data: { name, planType, userLimit, price, durationDays, features },
    });

    res.status(201).json({ message: "Plan ban gaya", plan });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Saare plans dekho
export const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
    });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// ── Admin manage karna ──────────────────────────

// Naya Admin enroll karo (client ko admin banao)
export const enrollAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, planId } = req.body;

    // Plan check karo
    const plan = await prisma.plan.findUnique({
      where: { id: parseInt(planId) },
    });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: "Plan nahi mila ya inactive hai" });
    }

    // Admin banao
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: "ADMIN",
      },
    });

    // Plan assign karo
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const adminPlan = await prisma.adminPlan.create({
      data: {
        adminId: admin.id,
        planId: plan.id,
        endDate,
      },
    });

    res.status(201).json({
      message: "Admin enroll ho gaya",
      admin: { id: admin.id, name: admin.name, email: admin.email },
      plan: { name: plan.name, userLimit: plan.userLimit, endDate },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Email pehle se exist karta hai" });
    }
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin ka plan upgrade/change karo
export const updateAdminPlan = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { planId } = req.body;

    const plan = await prisma.plan.findUnique({
      where: { id: parseInt(planId) },
    });
    if (!plan) return res.status(404).json({ message: "Plan nahi mila" });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const updated = await prisma.adminPlan.update({
      where: { adminId: parseInt(adminId) },
      data: { planId: plan.id, status: "ACTIVE", endDate },
    });

    res.json({ message: "Plan update ho gaya", updated });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Saare admins dekho with plan info
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isDeleted: false },
      include: {
        adminPlan: { include: { plan: true } },
        _count: { select: { users: true } },
      },
    });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin soft delete
export const softDeleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    await prisma.user.update({
      where: { id: parseInt(adminId) },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });
    res.json({ message: "Admin soft delete ho gaya" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin hard delete
export const hardDeleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    await prisma.user.delete({ where: { id: parseInt(adminId) } });
    res.json({ message: "Admin permanently delete ho gaya" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Super Admin apna user bana sakta hai (role: USER, adminId: null)
export const createSuperAdminUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name, email,
        password: hashedPassword,
        phone,
        role: "USER",
        adminId: null, // Super admin ke under directly
      },
    });

    res.status(201).json({
      message: "Super Admin ka user ban gaya",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Email pehle se exist karta hai" });
    }
    res.status(500).json({ message: "Error", error: err.message });
  }
};