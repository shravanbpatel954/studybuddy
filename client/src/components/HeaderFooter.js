import React from "react";
import "./HeaderFooter.css"; // CSS file

export default function HeaderFooter({ children }) {
  return (
    <>
      {/* HEADER */}
      <header className="hf-header">
        <h2 className="hf-title">StudyBuddy</h2>
      </header>

      {/* POINTS BOX BELOW HEADER
      <div className="hf-points-section">
        <div className="hf-points-box">
          <p>Points: 0</p>
        </div>
      </div> */}

      {/* MAIN CONTENT */}
      <div className="hf-content">{children}</div>

      {/* MOBILE FOOTER NAVIGATION - REMOVED (using MobileBottomNav instead) */}
    </>
  );
}
