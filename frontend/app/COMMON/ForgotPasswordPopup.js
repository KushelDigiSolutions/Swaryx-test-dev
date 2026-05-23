"use client";
import "./LoginPopup.css";
import { FiX, FiMail, FiCpu } from "react-icons/fi";
import { useState, useEffect } from "react";
import { GiChaingun } from "react-icons/gi";

export default function ForgotPasswordPopup({ onClose, onBackToLogin }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="loginPopup-overlay" onClick={onClose}>
      <div className="loginPopup-card" onClick={(e) => e.stopPropagation()}>
        <button className="loginPopup-skip" onClick={onClose} aria-label="Close">
          <FiX />
        </button>

        <div className="loginPopup-header-center">
          <div className="loginPopup-avatar">
            <GiChaingun />
          </div>
          <p className="loginPopup-welcome">Reset your password</p>
          <h2 className="loginPopup-title">Forgot Password?</h2>
        </div>

        <div className="loginPopup-body">
          <div className="loginPopup-field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="button" className="loginPopup-submitButton">
            Send reset link
          </button>

          <div className="loginPopup-divider">
            <span>Or</span>
          </div>

          <p className="loginPopup-footer">
            Remembered? <span onClick={onBackToLogin}>Login</span>
          </p>
        </div>
      </div>
    </div>
  );
}
