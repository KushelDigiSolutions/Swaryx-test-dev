// import jwt from "jsonwebtoken";

// // Token verify karo
// export const verifyToken = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Invalid token format" });
//   }

//   const token = authHeader.split(" ")[1];

//   if (!token) {
//     return res.status(401).json({ message: "Token nahi mila" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // { id, role, adminId }
//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Token invalid hai" });
//   }
// };

// // Role check karo
// export const authorizeRoles = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         message: `Sirf ${roles.join(", ")} access kar sakta hai`,
//       });
//     }
//     next();
//   };
// };


import jwt from "jsonwebtoken";

// 🔐 Token Verify Middleware
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Token missing or invalid format",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

// 🔐 Role Authorization Middleware
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access allowed only for: ${roles.join(", ")}`,
      });
    }

    next();
  };
};