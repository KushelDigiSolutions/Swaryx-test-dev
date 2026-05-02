import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createPlan, getAllPlans,
  enrollAdmin, getAllAdmins, updateAdminPlan,
  softDeleteAdmin, hardDeleteAdmin,
  createSuperAdminUser,
} from "../controllers/superAdminController.js";

const router = express.Router();

// Saare routes sirf SUPER_ADMIN ke liye
router.use(verifyToken, authorizeRoles("SUPER_ADMIN"));

// Plan routes
router.post("/plans", createPlan);
router.get("/plans", getAllPlans);

// Admin routes
router.post("/admins/enroll", enrollAdmin);
router.get("/admins", getAllAdmins);
router.patch("/admins/:adminId/plan", updateAdminPlan);
router.patch("/admins/:adminId/soft-delete", softDeleteAdmin);
router.delete("/admins/:adminId/hard-delete", hardDeleteAdmin);

// Super Admin ka apna user
router.post("/users", createSuperAdminUser);

export default router;