import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/user.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("User Service Running...");
});

app.listen(process.env.PORT, () => {
  console.log(`User Service running on ${process.env.PORT}`);
});