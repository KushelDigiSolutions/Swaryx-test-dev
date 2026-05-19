import jwt from "jsonwebtoken";

// Token verify karo
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token nahi mila" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, adminId }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid hai" });
  }
};

// Role check karo
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Sirf ${roles.join(", ")} access kar sakta hai`,
      });
    }
    next();
  };
};