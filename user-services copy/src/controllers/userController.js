import prisma from "../../utils/prisma.js";

// User apni profile dekhe
export const getMyProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true,
        phone: true, role: true, createdAt: true,
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

// User apni profile update kare
export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone },
      select: { id: true, name: true, email: true, phone: true },
    });
    res.json({ message: "Profile update ho gayi", updated });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};