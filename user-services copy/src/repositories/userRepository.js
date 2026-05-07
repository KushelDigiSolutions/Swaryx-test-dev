import prisma from "../../utils/prisma.js";

export const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const updateUser = (email, data) => {
  return prisma.user.update({
    where: { email },
    data,
  });
};

export const createSession = (data) => {
  return prisma.session.create({ data });
};

export const findSession = (refreshToken) => {
  return prisma.session.findUnique({
    where: { refreshToken },
  });
};

export const deactivateSession = (refreshToken) => {
  return prisma.session.update({
    where: { refreshToken },
    data: { isActive: false },
  });
};