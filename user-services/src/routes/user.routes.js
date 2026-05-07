import express from "express";
import prisma from "../../utils/prisma.js";
import jwt from "jsonwebtoken";

const router = express.Router();
// const prisma = new PrismaClient();

//////////////////////////////////////
// 🔐 VERIFY TOKEN (FROM AUTH SERVICE)
//////////////////////////////////////

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

//////////////////////////////////////
// 🏢 CREATE ORGANIZATION
//////////////////////////////////////

router.post("/organization", verifyToken, async (req, res) => {
  try {
    const { name, industry, companySize } = req.body;

    const org = await prisma.organization.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        industry,
        companySize,
        ownerId: req.user.userId, // auth user id
      },
    });

    res.status(201).json({
      message: "Organization created",
      organization: org,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

//////////////////////////////////////
// 👤 CREATE USER (AGENT / EMPLOYEE)
//////////////////////////////////////

router.post("/user", verifyToken, async (req, res) => {
  try {
    const {
      authUserId,
      organizationId,
      firstName,
      lastName,
      email,
      role,
      phone,
      department,
      designation,
      employeeId,
    } = req.body;

    //////////////////////////////////////
    // 🔐 VALIDATION
    //////////////////////////////////////

    if (!authUserId) {
      return res.status(400).json({
        message: "authUserId is required",
      });
    }

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        message: "firstName, lastName and email are required",
      });
    }

    //////////////////////////////////////
    // 🔥 SUPER_ADMIN CASE
    //////////////////////////////////////

    // SUPER_ADMIN does NOT need organization
    if (role !== "SUPER_ADMIN" && !organizationId) {
      return res.status(400).json({
        message: "organizationId is required",
      });
    }

    //////////////////////////////////////
    // 📦 CREATE USER DATA
    //////////////////////////////////////

    const userData = {
      authUserId,
      firstName,
      lastName,
      email,
      phone,
      department,
      designation,
      employeeId,
      role: role || "AGENT",
    };

    //////////////////////////////////////
    // 🏢 CONNECT ORGANIZATION
    //////////////////////////////////////

    // only for ORG_ADMIN / AGENT / MANAGER
    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
      });

      if (!organization) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }

      userData.organization = {
        connect: {
          id: organizationId,
        },
      };
    }

    //////////////////////////////////////
    // 👤 CREATE USER
    //////////////////////////////////////

    const user = await prisma.user.create({
      data: userData,
    });

    //////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "User creation failed",
      error: error.message,
    });
  }
});

//////////////////////////////////////
// 👥 GET ALL USERS (BY ORG)
//////////////////////////////////////

router.get("/users/:orgId", verifyToken, async (req, res) => {
  try {
    const { orgId } = req.params;

    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

//////////////////////////////////////
// 👤 GET SINGLE USER
//////////////////////////////////////

router.get("/user/:id", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "User not found" });
  }
});

//////////////////////////////////////
// ✏️ UPDATE USER
//////////////////////////////////////

router.put("/user/:id", verifyToken, async (req, res) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({
      message: "User updated",
      user: updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

//////////////////////////////////////
// ❌ DELETE USER
//////////////////////////////////////

router.delete("/user/:id", verifyToken, async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
});

//////////////////////////////////////
// 🏢 GET ORGANIZATION
//////////////////////////////////////

router.get("/organization/:id", verifyToken, async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { users: true },
    });

    res.json(org);
  } catch (error) {
    res.status(500).json({ message: "Org fetch failed" });
  }
});

export default router;