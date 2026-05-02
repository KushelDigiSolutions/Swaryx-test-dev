import prisma from "../../utils/prisma.js";

// Admin ka user limit check karo before creating new user
export const checkUserLimit = async (req, res, next) => {
  try {
    const adminId = req.user.role === "ADMIN"
      ? req.user.id
      : req.body.adminId; // Super admin kisi bhi admin ke liye bana sakta hai

    if (!adminId) return next(); // Super admin apne liye bana raha hai

    const adminPlan = await prisma.adminPlan.findUnique({
      where: { adminId: parseInt(adminId) },
      include: { plan: true },
    });

    if (!adminPlan) {
      return res.status(403).json({ message: "Admin ka koi plan nahi hai" });
    }

    if (adminPlan.status !== "ACTIVE") {
      return res.status(403).json({ message: "Admin ka plan active nahi hai" });
    }

    // Plan expire check
    if (new Date() > adminPlan.endDate) {
      await prisma.adminPlan.update({
        where: { adminId: parseInt(adminId) },
        data: { status: "EXPIRED" },
      });
      return res.status(403).json({ message: "Admin ka plan expire ho gaya" });
    }

    // User limit check
    if (adminPlan.currentUserCount >= adminPlan.plan.userLimit) {
      return res.status(403).json({
        message: `User limit full hai. Plan mein sirf ${adminPlan.plan.userLimit} users allowed hain`,
        currentCount: adminPlan.currentUserCount,
        limit: adminPlan.plan.userLimit,
      });
    }

    req.adminPlan = adminPlan; // Next middleware/controller mein use hoga
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};