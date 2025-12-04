import React from "react";
import "./HeaderFooter.css"; // CSS file

export default function HeaderFooter({ children }) {
  return (
    <>
      {/* HEADER */}
      <header className="hf-header">
        <h2 className="hf-title">StudyBuddy</h2>

        {/* CHAT ICON */}
        <button className="hf-chat-btn">
          💬
        </button>
      </header>

      {/* POINTS BOX BELOW HEADER
      <div className="hf-points-section">
        <div className="hf-points-box">
          <p>Points: 0</p>
        </div>
      </div> */}

      {/* MAIN CONTENT */}
      <div className="hf-content">{children}</div>

      {/* MOBILE FOOTER NAVIGATION */}
      <footer className="hf-footer">
        <button>🏠 <span>Home</span></button>
        <button>📚 <span>Modules</span></button>
        <button>🎮 <span>Games</span></button>
        <button>👤 <span>Profile</span></button>
      </footer>
    </>
  );
}
