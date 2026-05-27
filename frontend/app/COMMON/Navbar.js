"use client";
import "./Navbar.css";
import LoginPopup from "./LoginPopup";
import SignupPopup from "./SignupPopup";
import ForgotPasswordPopup from "./ForgotPasswordPopup";
import { FiSearch, FiBell, FiX } from "react-icons/fi";
import { MdAccountCircle } from "react-icons/md";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const [search, setSearch] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <>
      <div className="ai-adminNav-navbar">
        {/* LEFT - SEARCH */}
        <div className="ai-adminNav-left">
          <div className="ai-adminNav-searchBox">
            <FiSearch className="ai-adminNav-searchIcon" />

            <input
              type="text"
              placeholder="Search leads, calls, or assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <button
                type="button"
                className="ai-adminNav-clearButton"
                onClick={() => setSearch("")}
              >
                <FiX className="ai-adminNav-clearIcon" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="ai-adminNav-right">
          <FiBell className="ai-adminNav-icon" />
          <Sparkles className="ai-adminNav-icon" />

          <div
            className="ai-adminNav-profile"
            onClick={() => {
              setShowLogin(true);
              setShowSignup(false);
            }}
            style={{ cursor: "pointer" }}
          >
            {!isLoggedIn && <MdAccountCircle size={30} className="ai-adminNav-accountIcon" />}
            {isLoggedIn && (
              <>
                <div className="ai-adminNav-userText">
                  <span className="ai-adminNav-name">Admin Portal</span>
                  <span className="ai-adminNav-role">Executive Mode</span>
                </div>

                <img
                  src="https://i.pravatar.cc/40"
                  alt="user"
                  className="ai-adminNav-avatar"
                />
              </>
            )}
          </div>
        </div>
      </div>
      {showLogin && (
        <LoginPopup
          onClose={() => setShowLogin(false)}
          onSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
          onForgot={() => {
            setShowLogin(false);
            setShowForgot(true);
            setShowSignup(false);
          }}
          onLogin={() => {
            setShowLogin(false);
            setIsLoggedIn(true);
          }}
        />
      )}
      {showSignup && (
        <SignupPopup
          onClose={() => setShowSignup(false)}
          onSwitchToLogin={() => {
            setShowSignup(false);
            setShowLogin(true);
          }}
          onSignupSuccess={() => {
            setShowSignup(false);
            setIsLoggedIn(true);
          }}
        />
      )}
      {showForgot && (
        <ForgotPasswordPopup
          onClose={() => setShowForgot(false)}
          onBackToLogin={() => {
            setShowForgot(false);
            setShowLogin(true);
          }}
        />
      )}
    </>
  );
}
