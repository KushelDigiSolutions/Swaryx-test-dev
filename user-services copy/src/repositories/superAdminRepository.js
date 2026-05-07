import prisma from "../../utils/prisma.js";

export const createPlanRepo = (data) => {
  return prisma.plan.create({ data });
};

export const getAllPlansRepo = () => {
  return prisma.plan.findMany({
    where: { isActive: true },
  });
};

export const findPlanByIdRepo = (id) => {
  return prisma.plan.findUnique({
    where: { id },
  });
};

export const createAdminRepo = (data) => {
  return prisma.user.create({ data });
};

export const createAdminPlanRepo = (data) => {
  return prisma.adminPlan.create({ data });
};

export const getAllAdminsRepo = () => {
  return prisma.user.findMany({
    where: { role: "ADMIN", isDeleted: false },
      include: {
        adminPlan: { include: { plan: true } },
        _count: { select: { users: true } },
      },
  });
};

export const updateAdminPlanRepo = (adminId, data) => {
  return prisma.adminPlan.update({
    where: { adminId },
    data,
  });
};

export const softDeleteAdminRepo = (adminId) => {
  return prisma.user.update({
    where: { id: adminId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });
};

export const hardDeleteAdminRepo = (adminId) => {
  return prisma.user.delete({
    where: { id: adminId },
  });
};

export const createUserRepo = (data) => {
  return prisma.user.create({ data });
};