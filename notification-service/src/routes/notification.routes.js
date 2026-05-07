import express from "express";
import prisma from "../../utils/prisma.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const router = express.Router();


//////////////////////////////////////
// 🔐 VERIFY TOKEN
//////////////////////////////////////

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

//////////////////////////////////////
// 📧 MAIL CONFIG (SMTP)
//////////////////////////////////////

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

//////////////////////////////////////
// 📧 SEND EMAIL
//////////////////////////////////////

router.post("/send-email", verifyToken, async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);

    // save log
    await prisma.notification.create({
      data: {
        userId: req.user.userId,
        type: "EMAIL",
        title: subject,
        message,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error(error);

    await prisma.notification.create({
      data: {
        userId: req.user.userId,
        type: "EMAIL",
        title: req.body.subject,
        message: req.body.message,
        status: "FAILED",
      },
    });

    res.status(500).json({ message: "Email failed" });
  }
});

//////////////////////////////////////
// 📜 GET USER NOTIFICATIONS
//////////////////////////////////////

router.get("/my", verifyToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

//////////////////////////////////////
// 📨 CREATE INTERNAL NOTIFICATION
//////////////////////////////////////

router.post("/create", verifyToken, async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "EMAIL",
        title,
        message,
        status: "PENDING",
      },
    });

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Create failed" });
  }
});

//////////////////////////////////////
// 🔄 RETRY FAILED NOTIFICATIONS
//////////////////////////////////////

router.post("/retry", verifyToken, async (req, res) => {
  try {
    const failedNotifications = await prisma.notification.findMany({
      where: { status: "FAILED" },
    });

    for (const n of failedNotifications) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: "test@example.com", // replace later
          subject: n.title,
          html: n.message,
        });

        await prisma.notification.update({
          where: { id: n.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch {
        // skip
      }
    }

    res.json({ message: "Retry attempted" });
  } catch (error) {
    res.status(500).json({ message: "Retry failed" });
  }
});

export default router;