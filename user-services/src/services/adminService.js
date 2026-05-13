import bcrypt from "bcryptjs";
import prisma from "../../utils/prisma.js";
import {
  getAdminPlanRepo,
  countAdminUsersRepo,
  createUserRepo,
  incrementUserCountRepo,
  decrementUserCountRepo,
  getUsersRepo,
  countUsersRepo,
  findUserByAdminRepo,
  softDeleteUserRepo,
  hardDeleteUserRepo
} from "../repositories/adminRepository.js";

// Dashboard (🔥 parallel queries for speed)
export const getAdminDashboardService = async (adminId) => {
  const [adminPlan, userCount] = await Promise.all([
    getAdminPlanRepo(adminId),
    countAdminUsersRepo(adminId),
  ]);

  return {
    plan: adminPlan?.plan?.name,
    planStatus: adminPlan?.status,
    planExpiry: adminPlan?.endDate,
    userLimit: adminPlan?.plan?.userLimit,
    currentUsers: userCount,
    remainingSlots: (adminPlan?.plan?.userLimit || 0) - userCount,
  };
};

// Create user (🔥 transaction = safe + fast)
export const createUserService = async (adminId, body) => {
  const { name, email, password, phone } = body;

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: "USER",
        adminId,
      },
    });

    await tx.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { increment: 1 } },
    });

    return user;
  });
};

// Get users (🔥 optimized pagination + parallel)
export const getMyUsersService = async (adminId, query) => {
  const { page = 1, limit = 10, search = "" } = query;

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
    getUsersRepo(where, skip, parseInt(limit)),
    countUsersRepo(where),
  ]);

  return {
    users,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// Soft delete
export const softDeleteUserService = async (adminId, userId) => {
  userId = parseInt(userId);

  const user = await findUserByAdminRepo(userId, adminId);
  if (!user) throw new Error("User nahi mila");

  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await tx.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { decrement: 1 } },
    });
  });
};

// Hard delete
export const hardDeleteUserService = async (adminId, userId) => {
  userId = parseInt(userId);

  const user = await findUserByAdminRepo(userId, adminId);
  if (!user) throw new Error("User nahi mila");

  return await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } });

    await tx.adminPlan.update({
      where: { adminId },
      data: { currentUserCount: { decrement: 1 } },
    });
  });
};