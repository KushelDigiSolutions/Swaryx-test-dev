/**
 * =========================================================
 * 📦 Authentication Routes Module
 * =========================================================
 * This module handles:
 * - User Registration
 * - User Login
 * - JWT Authentication
 * - Refresh Token Handling
 * - Logout
 * - Current User Profile
 * - Email Verification
 * - Password Reset
 *
 * Tech Stack:
 * - Express.js
 * - Prisma ORM
 * - JWT Authentication
 * - bcrypt Password Hashing
 * =========================================================
 */

import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../../utils/sendNotification.js";
import axios from "axios";


const router = express.Router();

/**
 * ---------------------------------------------------------
 * Generate Access Token
 * ---------------------------------------------------------
 * Creates a short-lived JWT token for API authentication.
 *
 * Payload:
 * - userId
 * - role
 *
 * Expiry:
 * - 1 Hour
 * ---------------------------------------------------------
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
};

/**
 * ---------------------------------------------------------
 * Generate Refresh Token
 * ---------------------------------------------------------
 * Creates a long-lived token used to generate
 * new access tokens without re-login.
 *
 * Expiry:
 * - 7 Days
 * ---------------------------------------------------------
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/**
 * ---------------------------------------------------------
 * Verify JWT Access Token
 * ---------------------------------------------------------
 * This middleware:
 * - Reads token from Authorization header
 * - Verifies JWT token
 * - Attaches decoded user data to req.user
 * ---------------------------------------------------------
 *
 * Expected Header:
 * Authorization: Bearer <token>
 * ---------------------------------------------------------
 */
const verifyToken = (req, res, next) => {
  try {
    // Extract token from request header
    const token = req.headers.authorization?.split(" ")[1];

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token not provided",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user data to request
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};


/**
 * ---------------------------------------------------------
 * @route   POST /register
 * @desc    Register a new user
 * @access  Public
 * ---------------------------------------------------------
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "123456",
 *   "role": "ORG_ADMIN"
 * }
 * ---------------------------------------------------------
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    ////////////////////////////////////////////////////////
    // Check if user already exists
    ////////////////////////////////////////////////////////
    const existingUser = await prisma.userAuth.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    ////////////////////////////////////////////////////////
    // Hash password before saving
    ////////////////////////////////////////////////////////
    const hashedPassword = await bcrypt.hash(password, 10);

    ////////////////////////////////////////////////////////
    // Create new user
    ////////////////////////////////////////////////////////
    const user = await prisma.userAuth.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "ORG_ADMIN",
      },
    });

    ////////////////////////////////////////////////////////
    // Generate JWT tokens
    ////////////////////////////////////////////////////////
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    ////////////////////////////////////////////////////////
    // Save refresh token in database
    ////////////////////////////////////////////////////////
    await prisma.userAuth.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    try {
      console.log("Sending notification...");
    
      const notificationResponse = await sendNotification({
        token: accessToken,
    
        // internal notification
        userId: user.id,
    
        title: "Account Created",
        message: "Welcome to Swaryx AI Platform",
    
        // email
        sendEmail: true,
    
        to: email,
    
        subject: "Welcome to Swaryx AI",
    
        html: `
          <h1>Welcome ${email}</h1>
    
          <p>
            Your account has been created successfully.
          </p>
    
          <p>
            Role: ${role || "ORG_ADMIN"}
          </p>
        `,
      });
    
      console.log("Notification Response:", notificationResponse);
    
    } catch (notificationError) {
      console.error(
        "Notification Failed:",
        notificationError?.response?.data || notificationError.message
      );
    }

    ////////////////////////////////////////////////////////
    // Send response
    ////////////////////////////////////////////////////////
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});


/**
 * ---------------------------------------------------------
 * @route   POST /login
 * @desc    Authenticate user and return tokens
 * @access  Public
 * ---------------------------------------------------------
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "123456"
 * }
 * ---------------------------------------------------------
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    ////////////////////////////////////////////////////////
    // Find user by email
    ////////////////////////////////////////////////////////
    const user = await prisma.userAuth.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    ////////////////////////////////////////////////////////
    // Compare password with hashed password
    ////////////////////////////////////////////////////////
    const isPasswordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatched) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    ////////////////////////////////////////////////////////
    // Generate new tokens
    ////////////////////////////////////////////////////////
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    ////////////////////////////////////////////////////////
    // Update refresh token in DB
    ////////////////////////////////////////////////////////
    await prisma.userAuth.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    ////////////////////////////////////////////////////////
    // Send success response
    ////////////////////////////////////////////////////////
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

////////////////////////////////////////////////////////////
// 🟡 REFRESH ACCESS TOKEN
////////////////////////////////////////////////////////////

/**
 * ---------------------------------------------------------
 * @route   POST /refresh
 * @desc    Generate new access token using refresh token
 * @access  Public
 * ---------------------------------------------------------
 *
 * Request Body:
 * {
 *   "refreshToken": "your_refresh_token"
 * }
 * ---------------------------------------------------------
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    ////////////////////////////////////////////////////////
    // Validate refresh token existence
    ////////////////////////////////////////////////////////
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    ////////////////////////////////////////////////////////
    // Verify refresh token
    ////////////////////////////////////////////////////////
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    ////////////////////////////////////////////////////////
    // Find user from decoded token
    ////////////////////////////////////////////////////////
    const user = await prisma.userAuth.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    ////////////////////////////////////////////////////////
    // Validate stored refresh token
    ////////////////////////////////////////////////////////
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    ////////////////////////////////////////////////////////
    // Generate new access token
    ////////////////////////////////////////////////////////
    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh Token Error:", error);

    return res.status(403).json({
      success: false,
      message: "Refresh token expired or invalid",
    });
  }
});


/**
 * ---------------------------------------------------------
 * @route   POST /logout
 * @desc    Logout user and clear refresh token
 * @access  Private
 * ---------------------------------------------------------
 */
router.post("/logout", verifyToken, async (req, res) => {
  try {
    ////////////////////////////////////////////////////////
    // Remove refresh token from database
    ////////////////////////////////////////////////////////
    await prisma.userAuth.update({
      where: {
        id: req.user.userId,
      },
      data: {
        refreshToken: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
});


/**
 * ---------------------------------------------------------
 * @route   GET /me
 * @desc    Get logged-in user details
 * @access  Private
 * ---------------------------------------------------------
 */
router.get("/me", verifyToken, async (req, res) => {
  try {
    ////////////////////////////////////////////////////////
    // Fetch authenticated user details
    ////////////////////////////////////////////////////////
    const user = await prisma.userAuth.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Fetch User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});


/**
 * ---------------------------------------------------------
 * @route   POST /verify-email
 * @desc    Verify user email
 * @access  Public
 * ---------------------------------------------------------
 *
 * Request Body:
 * {
 *   "userId": "user_id"
 * }
 * ---------------------------------------------------------
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { userId } = req.body;

    ////////////////////////////////////////////////////////
    // Update verification status
    ////////////////////////////////////////////////////////
    await prisma.userAuth.update({
      where: { id: userId },
      data: {
        isVerified: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email Verification Error:", error);

    return res.status(500).json({
      success: false,
      message: "Email verification failed",
    });
  }
});


/**
 * ---------------------------------------------------------
 * @route   POST /reset-password
 * @desc    Reset user password
 * @access  Public
 * ---------------------------------------------------------
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "newPassword": "newpassword123"
 * }
 * ---------------------------------------------------------
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    ////////////////////////////////////////////////////////
    // Find user by email
    ////////////////////////////////////////////////////////
    const user = await prisma.userAuth.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    ////////////////////////////////////////////////////////
    // Hash new password
    ////////////////////////////////////////////////////////
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    ////////////////////////////////////////////////////////
    // Update password
    ////////////////////////////////////////////////////////
    await prisma.userAuth.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
});


export default router;