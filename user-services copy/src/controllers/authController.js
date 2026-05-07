import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../../utils/mail.js";
import jwt from "jsonwebtoken";
import {
  loginService,
  verifyOtpService,
  forgotPasswordService,
  resetPasswordService,
  refreshTokenService,
  logoutService,
} from "../services/authService.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    await loginService(email, password);

    return res.json({
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log(error)
    return res.status(400).json({
      message: error.message,
    });
  }
};


export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const data = await verifyOtpService(email, otp);

    return res.json({
      message: "Login successful",
      ...data,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    await forgotPasswordService(email);

    return res.json({
      message: "OTP sent to email",
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

// 🔹 Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    await resetPasswordService(email, otp, newPassword);

    return res.json({
      message: "Password reset successful",
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const token = await refreshTokenService(refreshToken);

    res.json({ accessToken: token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    await logoutService(refreshToken);

    res.json({ message: "Logged out" });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};