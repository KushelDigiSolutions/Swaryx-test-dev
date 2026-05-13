// utils/sendNotification.js

import axios from "axios";

/**
 * =========================================================
 * 🔔 SEND NOTIFICATION UTILITY
 * =========================================================
 *
 * Supports:
 * ✅ Single User Notification
 * ✅ Multiple Users Notification
 * ✅ Email Notification
 * ✅ Internal Notification
 * ✅ Reusable Across Services
 *
 * Usage:
 * await sendNotification({...})
 *
 * =========================================================
 */

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL ||
  "http://localhost:5004/api/notification";

/**
 * =========================================================
 * 🔔 Send Notification
 * =========================================================
 */

export const sendNotification = async ({
  token,

  // email
  to,
  subject,
  html,

  // internal notification
  userId,
  userIds,
  title,
  message,

  // type
  sendEmail = false,
  createInternal = true,
}) => {

  console.log("Runniung from utils")
  try {
    ////////////////////////////////////////////////////////
    // 🔐 COMMON HEADERS
    ////////////////////////////////////////////////////////

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    ////////////////////////////////////////////////////////
    // 📧 SEND EMAIL
    ////////////////////////////////////////////////////////

    if (sendEmail && to) {
      await axios.post(
        `${NOTIFICATION_SERVICE_URL}/send-email`,
        {
          to,
          subject,
          message: html,
        },
        { headers }
      );
    }

    ////////////////////////////////////////////////////////
    // 👤 SINGLE USER NOTIFICATION
    ////////////////////////////////////////////////////////

    if (createInternal && userId) {
      await axios.post(
        `${NOTIFICATION_SERVICE_URL}/create`,
        {
          userId,
          title,
          message,
        },
        { headers }
      );
    }

    ////////////////////////////////////////////////////////
    // 👥 MULTIPLE USERS NOTIFICATION
    ////////////////////////////////////////////////////////

    if (createInternal && userIds?.length > 0) {
      await Promise.all(
        userIds.map((id) =>
          axios.post(
            `${NOTIFICATION_SERVICE_URL}/create`,
            {
              userId: id,
              title,
              message,
            },
            { headers }
          )
        )
      );
    }

    ////////////////////////////////////////////////////////
    // ✅ SUCCESS
    ////////////////////////////////////////////////////////

    return {
      success: true,
      message: "Notification processed successfully",
    };
  } catch (error) {
    console.error("SEND NOTIFICATION ERROR:", error?.response?.data || error);

    return {
      success: false,
      message: "Notification failed",
      error: error?.response?.data || error.message,
    };
  }
};