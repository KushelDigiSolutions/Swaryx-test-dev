import prisma from "../../utils/prisma.js";

// Dashboard
export const getAdminPlanRepo = (adminId) => {
  return prisma.adminPlan.findUnique({
    where: { adminId },
    include: { plan: true },
  });
};

export const countAdminUsersRepo = (adminId) => {
  return prisma.user.count({
    where: { adminId, isDeleted: false },
  });
};

// Create user
export const createUserRepo = (data) => {
  return prisma.user.create({ data });
};

export const incrementUserCountRepo = (adminId) => {
  return prisma.adminPlan.update({
    where: { adminId },
    data: { currentUserCount: { increment: 1 } },
  });
};

export const decrementUserCountRepo = (adminId) => {
  return prisma.adminPlan.update({
    where: { adminId },
    data: { currentUserCount: { decrement: 1 } },
  });
};

// Get users
export const getUsersRepo = (where, skip, take) => {
  return prisma.user.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const countUsersRepo = (where) => {
  return prisma.user.count({ where });
};

// Find user (ownership check)
export const findUserByAdminRepo = (userId, adminId) => {
  return prisma.user.findFirst({
    where: { id: userId, adminId },
  });
};

// Delete
export const softDeleteUserRepo = (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });
};

export const hardDeleteUserRepo = (userId) => {
  return prisma.user.delete({
    where: { id: userId },
  });
};