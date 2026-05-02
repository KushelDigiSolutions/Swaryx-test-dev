import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { getMyProfile, updateMyProfile } from "../controllers/userController.js";

const router = express.Router();

router.use(verifyToken, authorizeRoles("USER"));

router.get("/profile", getMyProfile);
router.patch("/profile", updateMyProfile);

export default router;