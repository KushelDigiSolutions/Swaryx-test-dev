
import {
  createPlanService,
  getAllPlansService,
  enrollAdminService,
  updateAdminPlanService,
  getAllAdminsService,
  softDeleteAdminService,
  hardDeleteAdminService,
  createSuperAdminUserService
} from "../services/superAdminService.js";

// ── Plans ─────────────────────────────

export const createPlan = async (req, res) => {
  try {
    const plan = await createPlanService(req.body);

    res.status(201).json({
      message: "Plan ban gaya",
      plan
    });
  } catch (err) {
    res.status(500).json({
      message: "Plan create karne me error",
      error: err.message
    });
  }
};

export const getAllPlans = async (req, res) => {
  try {
    const plans = await getAllPlansService();

    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({
      message: "Plans fetch karne me error",
      error: err.message
    });
  }
};

// ── Admin ─────────────────────────────

export const enrollAdmin = async (req, res) => {
  try {
    const result = await enrollAdminService(req.body);

    res.status(201).json({
      message: "Admin enroll ho gaya",
      admin: {
        id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email
      },
      plan: {
        name: result.plan.name,
        userLimit: result.plan.userLimit,
        endDate: result.endDate
      }
    });
  } catch (err) {
    res.status(400).json({
      message: "Admin enroll karne me error",
      error: err.message
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await getAllAdminsService();

    res.status(200).json(admins);
  } catch (err) {
    res.status(500).json({
      message: "Admins fetch karne me error",
      error: err.message
    });
  }
};

export const updateAdminPlan = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { planId } = req.body;

    const updated = await updateAdminPlanService(adminId, planId);

    res.status(200).json({
      message: "Admin plan update ho gaya",
      updated
    });
  } catch (err) {
    res.status(400).json({
      message: "Plan update karne me error",
      error: err.message
    });
  }
};

export const softDeleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    await softDeleteAdminService(adminId);

    res.status(200).json({
      message: "Admin soft delete ho gaya"
    });
  } catch (err) {
    res.status(500).json({
      message: "Soft delete me error",
      error: err.message
    });
  }
};

export const hardDeleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    await hardDeleteAdminService(adminId);

    res.status(200).json({
      message: "Admin permanently delete ho gaya"
    });
  } catch (err) {
    res.status(500).json({
      message: "Hard delete me error",
      error: err.message
    });
  }
};

// ── Super Admin User ─────────────────────────────

export const createSuperAdminUser = async (req, res) => {
  try {
    const user = await createSuperAdminUserService(req.body);

    res.status(201).json({
      message: "Super Admin ka user ban gaya",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(400).json({
      message: "User create karne me error",
      error: err.message
    });
  }
};