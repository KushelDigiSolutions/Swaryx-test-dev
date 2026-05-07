import express from "express";
import dotenv from "dotenv";
import subscriptionRoutes from "./src/routes/subscription.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

// subscription-service/app.js mein yeh hona chahiye
app.use("/", subscriptionRoutes);

app.get("/", (req, res) => {
  res.send("Subscription Service Running...");
});

app.listen(process.env.PORT, () => {
  console.log(`Subscription Service running on ${process.env.PORT}`);
});