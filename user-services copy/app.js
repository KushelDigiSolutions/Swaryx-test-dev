import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import superAdminRoutes from "./src/routes/superAdminRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);

// Super-Admin
app.use("/api/super-admin", superAdminRoutes);


// admin
app.use("/api/admin", adminRoutes);

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "User Service running", port: 5001 });
});

app.listen(5001, () => {
  console.log("User Service running on http://localhost:5001");
});