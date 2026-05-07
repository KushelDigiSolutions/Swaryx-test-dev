import express from "express";
import dotenv from "dotenv";
import notificationRoutes from "./src/routes/notification.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/notification", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Notification Service Running...");
});

app.listen(process.env.PORT, () => {
  console.log(`Notification Service running on ${process.env.PORT}`);
});