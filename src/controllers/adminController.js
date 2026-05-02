import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";

// Admin apna dashboard dekhe
export const getAdminDashboard = async (req, res) => {
  try {
    const adminId = req.user.id;

    const adminPlan = await prisma.adminPlan.findUnique({
      where: { adminId },
      include: { plan: true },
    });

    const userCount = await prisma.user.count({
      where: { adminId, isDeleted: false },
    });

    res.json({
      plan: adminPlan?.plan?.name,
      planStatus: adminPlan?.status,
      planExpiry: adminPlan?.endDate,
      userLimit: adminPlan?.plan?.userLimit,
      currentUsers: userCount,
      remainingSlots: (adminPlan?.plan?.userLimit || 0) - userCount,
    });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin naya user banaye (limit check middleware pehle chalega)
export const createUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { name, email, password, phone } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name, email,
        password: hashedPassword,
        phone,
        role: "USER",
        adminId,
      },
    });

    // User count update karo plan mein
    await prisma.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { increment: 1 } },
    });

    res.status(201).json({
      message: "User ban gaya",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Email pehle se exist karta hai" });
    }
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin apne saare users dekhe
export const getMyUsers = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { page = 1, limit = 10, search = "" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      adminId,
      isDeleted: false,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true, name: true, email: true,
          phone: true, isActive: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin user soft delete kare
export const softDeleteUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { userId } = req.params;

    // Check karo ki yeh user is admin ka hi hai
    const user = await prisma.user.findFirst({
      where: { id: parseInt(userId), adminId },
    });
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });

    // Count ghatao
    await prisma.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { decrement: 1 } },
    });

    res.json({ message: "User soft delete ho gaya" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// Admin user hard delete kare
export const hardDeleteUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: { id: parseInt(userId), adminId },
    });
    if (!user) return res.status(404).json({ message: "User nahi mila" });

    await prisma.user.delete({ where: { id: parseInt(userId) } });

    await prisma.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { decrement: 1 } },
    });

    res.json({ message: "User permanently delete ho gaya" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};