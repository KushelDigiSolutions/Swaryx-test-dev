import express from "express";
import {
    login, verifyOtp,
    forgotPassword, resetPassword,
    refreshToken,
  logout,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/verify-otp", verifyOtp);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/refresh-token", refreshToken);
router.post("/logout", logout);


export default router;