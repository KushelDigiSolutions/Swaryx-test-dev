// import { PrismaClient } from "@prisma/client";
// import jwt from "jsonwebtoken";
// import bcrypt from "bcrypt";

import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// const prisma = new PrismaClient({
//   datasourceUrl: process.env.DATABASE_URL,
// });

export const login = async (req, res) => {
  console.log("Login API HIT");
  try {
    const { email, password } = req.body;

    // 1. user check
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. password check
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 3. token generate
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 4. response
    res.json({
      message: "Login successful",
      token,
      user,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};