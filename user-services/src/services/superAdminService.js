import bcrypt from "bcryptjs";
import {
  createPlanRepo,
  getAllPlansRepo,
  findPlanByIdRepo,
  createAdminRepo,
  createAdminPlanRepo,
  getAllAdminsRepo,
  updateAdminPlanRepo,
  softDeleteAdminRepo,
  hardDeleteAdminRepo,
  createUserRepo
} from "../repositories/superAdminRepository.js";

// Plan
export const createPlanService = async (body) => {
  return await createPlanRepo(body);
};

export const getAllPlansService = async () => {
  return await getAllPlansRepo();
};

// Admin enroll
export const enrollAdminService = async (body) => {
  const { name, email, password, phone, planId } = body;

  const plan = await findPlanByIdRepo(parseInt(planId));
  if (!plan || !plan.isActive) {
    throw new Error("Invalid plan");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await createAdminRepo({
    name,
    email,
    password: hashedPassword,
    phone,
    role: "ADMIN",
  });

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  await createAdminPlanRepo({
    adminId: admin.id,
    planId: plan.id,
    endDate,
  });

  return { admin, plan, endDate };
};

// Update plan
export const updateAdminPlanService = async (adminId, planId) => {
  const plan = await findPlanByIdRepo(parseInt(planId));
  if (!plan) throw new Error("Plan not found");

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  return await updateAdminPlanRepo(parseInt(adminId), {
    planId: plan.id,
    status: "ACTIVE",
    endDate,
  });
};

export const getAllAdminsService = () => {
  return getAllAdminsRepo();
};

export const softDeleteAdminService = (adminId) => {
  return softDeleteAdminRepo(parseInt(adminId));
};

export const hardDeleteAdminService = (adminId) => {
  return hardDeleteAdminRepo(parseInt(adminId));
};

export const createSuperAdminUserService = async (body) => {
  const hashedPassword = await bcrypt.hash(body.password, 10);

  return createUserRepo({
    ...body,
    password: hashedPassword,
    role: "USER",
    adminId: null,
  });
};