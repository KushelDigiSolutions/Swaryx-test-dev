import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/mail.js";
import {
  findUserByEmail,
  updateUser,
  createSession,
  findSession,
  deactivateSession,
} from "../repositories/userRepository.js";

import prisma from "../../utils/prisma.js";

// 🔹 Common OTP generator
const generateOtp = () => {
  return {
    otp: Math.floor(100000 + Math.random() * 900000),
    otpExpiry: new Date(Date.now() + 5 * 60 * 1000), // 5 min
  };
};

// 🔹 LOGIN SERVICE (OTP send karega)
export const loginService = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid password");
  }

  const { otp, otpExpiry } = generateOtp();

  await updateUser(email, {
    otp,
    otpExpiry,
  });

  // 📧 non-blocking email
  sendEmail(
    user.email,
    "Login OTP",
    `Your OTP is ${otp}. It expires in 5 minutes.`
  ).catch((err) => console.error("Email error:", err.message));

  return true;
};

// 🔹 VERIFY OTP SERVICE
export const verifyOtpService = async (email, otp) => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }
  console.log("JWT_SECRET:", process.env.JWT_SECRET);
  const user = await findUserByEmail(email);

  if (!user || Number(user.otp) !== Number(otp)) {
    throw new Error("Invalid OTP");
  }

  // expiry check
  if (!user.otpExpiry || new Date() > user.otpExpiry) {
    throw new Error("OTP expired");
  }

  await prisma.session.deleteMany({
  where: { userId: user.id },
});

   const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );


   const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );


  // const token = jwt.sign(
  //   {
  //     id: user.id,
  //     role: user.role,
  //   },
  //   process.env.JWT_SECRET,
  //   { expiresIn: "1d" }
  // );

  await updateUser(email, {
    otp: null,
    otpExpiry: null,
  });

   await createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });


  const { password, ...safeUser } = user;

  return { accessToken, refreshToken, user: safeUser };
};

// 🔹 FORGOT PASSWORD (OTP send)
export const forgotPasswordService = async (email) => {
  if (!email) {
    throw new Error("Email is required");
  }

  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  const { otp, otpExpiry } = generateOtp();

  await updateUser(email, {
    otp,
    otpExpiry,
  });

  sendEmail(
    email,
    "Reset Password OTP",
    `Your OTP is ${otp}. It expires in 5 minutes.`
  ).catch((err) => console.error("Email error:", err.message));

  return true;
};

// 🔹 RESET PASSWORD
export const resetPasswordService = async (email, otp, newPassword) => {
  if (!email || !otp || !newPassword) {
    throw new Error("All fields are required");
  }

  const user = await findUserByEmail(email);

  if (!user || Number(user.otp) !== Number(otp)) {
    throw new Error("Invalid OTP");
  }

  if (!user.otpExpiry || new Date() > user.otpExpiry) {
    throw new Error("OTP expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await updateUser(email, {
    password: hashedPassword,
    otp: null,
    otpExpiry: null,
  });

  return true;
};


export const refreshTokenService = async (refreshToken) => {
  const session = await findSession(refreshToken);

  if (!session || !session.isActive) {
    throw new Error("Invalid session");
  }

  const payload = jwt.verify(
    refreshToken,
    process.env.JWT_REFRESH_SECRET
  );

  const newAccessToken = jwt.sign(
    { id: payload.id },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );

  return newAccessToken;
};

export const logoutService = async (refreshToken) => {
  await deactivateSession(refreshToken);
  return true;
};