// import express from "express";
// import prisma from "./utils/prisma.js";

// const app = express();
// app.use(express.json());

// // GET
// app.get("/users", async (req, res) => {
//     const users = await prisma.user.findMany();
//     res.json(users);
// });

// // POST
// // POST
// app.post("/users", async (req, res) => {
//     try {
//         const { name, email, address } = req.body;

//         // basic validation
//         if (!name || !email) {
//             return res.status(400).json({
//                 message: "Name and Email are required",
//             });
//         }

//         const user = await prisma.user.create({
//             data: { name, email, address },
//         });

//         res.status(201).json({
//             message: "User created successfully",
//             user,
//         });

//     } catch (error) {
//         console.error(error);

//         // unique email error handle
//         if (error.code === "P2002") {
//             return res.status(400).json({
//                 message: "Email already exists",
//             });
//         }

//         res.status(500).json({
//             message: "Internal server error",
//         });
//     }
// });

// app.listen(5000, () => {
//     console.log("Server running on http://localhost:5000");
// });




import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "User Service running", port: 5001 });
});

app.listen(5001, () => {
  console.log("User Service running on http://localhost:5001");
});