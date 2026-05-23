"use client";
import "./LoginPopup.css";
import { FiX, FiEye, FiEyeOff, FiCpu } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useState, useEffect } from "react";
import { GiChaingun } from "react-icons/gi";

export default function SignupPopup({ onClose, onSwitchToLogin, onSignupSuccess }) {
  const [passwordVisible, setPasswordVisible] = useState(false);

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
          <p className="loginPopup-welcome">Ready to join us?</p>
          <h2 className="loginPopup-title">Create your account!</h2>
        </div>

        <div className="loginPopup-body">

        <div className="loginPopup-field">
          <label>Full Name</label>
          <input type="text" placeholder="Haider Khan" />
        </div>

        <div className="loginPopup-field">
          <label>Email or username</label>
          <input type="text" placeholder="haidoo8721" />
        </div>

        <div className="loginPopup-field loginPopup-passwordField">
          <label>Password</label>
          <input
            type={passwordVisible ? "text" : "password"}
            placeholder="••••••••"
          />
          <button
            type="button"
            className="loginPopup-eyeButton"
            onClick={() => setPasswordVisible(!passwordVisible)}
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>

        <button
          type="button"
          className="loginPopup-submitButton"
          onClick={onSignupSuccess}
        >
          Sign Up
        </button>

        <div className="loginPopup-divider">
          <span>Or</span>
        </div>

        <div className="loginPopup-socialGroup">
          <button className="loginPopup-socialButton">
            <FcGoogle className="socialIcon google" />
            Sign up with Google
          </button>

          <button className="loginPopup-socialButton">
            <FaApple className="socialIcon apple" />
            Sign up with Apple
          </button>
        </div>

        <p className="loginPopup-footer">
          Already have an account? <span onClick={onSwitchToLogin}>Login</span>
        </p>
        </div>
      </div>
    </div>
  );
}
