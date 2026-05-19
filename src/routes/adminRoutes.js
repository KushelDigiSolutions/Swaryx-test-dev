import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { checkUserLimit } from "../middleware/checkUserLimit.js";
import {
  getAdminDashboard, createUser, getMyUsers,
  softDeleteUser, hardDeleteUser,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(verifyToken, authorizeRoles("ADMIN"));

router.get("/dashboard", getAdminDashboard);
router.get("/users", getMyUsers);
router.post("/users", checkUserLimit, createUser);
router.patch("/users/:userId/soft-delete", softDeleteUser);
router.delete("/users/:userId/hard-delete", hardDeleteUser);

export default router;