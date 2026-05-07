import express from "express";
import dotenv from "dotenv";
import authRoutes from "./src/routes/auth.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.get("/health", (req, res) => {
  console.log('Helo');
  res.send("Auth Service Running...");
});
app.use("/api/auth", authRoutes);



app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});