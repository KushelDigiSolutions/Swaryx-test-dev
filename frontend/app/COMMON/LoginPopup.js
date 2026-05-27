"use client";
import "./LoginPopup.css";
import { FiX, FiEye, FiEyeOff, FiCpu } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useState, useEffect } from "react";
import { GiChaingun } from "react-icons/gi";

export default function LoginPopup({ onClose, onSignup, onForgot, onLogin }) {
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
      <div
        className="loginPopup-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="loginPopup-skip" onClick={onClose} aria-label="Close">
          <FiX />
        </button>

        {/* Header */}
        <div className="loginPopup-header-center">
          <div className="loginPopup-avatar">
            <GiChaingun />
          </div>
          <p className="loginPopup-welcome">Hey there! Welcome back!</p>
          <h2 className="loginPopup-title">Login to your account!</h2>
        </div>

        <div className="loginPopup-body">

        {/* Email */}
        <div className="loginPopup-field">
          <label>Email or username</label>
          <input type="text" placeholder="Enter your email or username" />
        </div>

        {/* Password */}
        <div className="loginPopup-field loginPopup-passwordField">
          <label>Password</label>
          <input
            type={passwordVisible ? "text" : "password"}
            placeholder="Enter your password"
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
          onClick={onLogin}
        >
          Log In
        </button>

        <p className="loginPopup-forgot" onClick={onForgot}>
          Forgot Password?
        </p>

        {/* Divider */}
        <div className="loginPopup-divider">
          <span>Or</span>
        </div>

        {/* Social */}
        <div className="loginPopup-socialGroup">
          <button className="loginPopup-socialButton">
            <FcGoogle className="socialIcon google" />
            Sign in with Google
          </button>

          <button className="loginPopup-socialButton">
            <FaApple className="socialIcon apple" />
            Sign in with Apple
          </button>
        </div>

        {/* Footer */}
        <p className="loginPopup-footer">
          Don’t have an account? <span onClick={onSignup}>Sign Up</span>
        </p>
        </div>
      </div>
    </div>
  );
}