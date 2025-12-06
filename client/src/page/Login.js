import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { getApiBase } from "../utils/apiConfig";
import "./Login.css";

function SuccessModal({ open, message, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <motion.div
        className="custom-modal"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h3 className="modal-title">Email Sent!</h3>
        <p className="modal-message">{message}</p>

        <motion.button className="modal-ok-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
          OK
        </motion.button>
      </motion.div>
    </div>
  );
}

function ForgotEmailModal({ open, email, setEmail, onSubmit, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <motion.div
        className="custom-modal"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h3 className="modal-title">Forgot your password?</h3>
        <p className="modal-message">Enter your registered email. We will send you a reset link.</p>

        <input
          type="email"
          className="modal-input"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <motion.button className="modal-send-btn" onClick={onSubmit} whileTap={{ scale: 0.95 }}>
          Send Reset Link
        </motion.button>

        <button className="modal-cancel" onClick={onClose}>Cancel</button>
      </motion.div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetSuccessOpen, setResetSuccessOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    };

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        navigate("/dashboard");
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiBase = getApiBase();
    localStorage.setItem("postLoginRedirect", "/dashboard");
    window.location.href = `${apiBase}/auth/google?mode=signin`;
  };

  const handleForgotPassword = () => {
    setForgotEmail(formData.email.trim().toLowerCase());
    setForgotOpen(true);
  };

  const submitForgotPassword = async () => {
    if (!forgotEmail) {
      alert("Please enter your email.");
      return;
    }

    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      setForgotOpen(false);
      setResetSuccessOpen(true);
    } catch {
      setForgotOpen(false);
      setResetSuccessOpen(true);
    }
  };

  return (
    <div className="login-container">

      <div className="aurora-bg"></div>

      <ForgotEmailModal
        open={forgotOpen}
        email={forgotEmail}
        setEmail={setForgotEmail}
        onSubmit={submitForgotPassword}
        onClose={() => setForgotOpen(false)}
      />

      <SuccessModal
        open={resetSuccessOpen}
        message="If this email exists, a reset link has been sent."
        onClose={() => setResetSuccessOpen(false)}
      />

      <motion.form
        className="login-card"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        whileHover={{ scale: 1.01 }}
        onSubmit={handleSubmit}
      >
        <h2 className="login-title">Welcome Back</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="input-group">
          <input
            required
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder=" "
          />
          <label>Email</label>
        </div>

        <div className="input-group">
          <input
            required
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder=" "
          />
          <label>Password</label>
        </div>

        <motion.button
          type="submit"
          className="btn-login animated-btn"
          disabled={loading}
          whileTap={{ scale: 0.95 }}
        >
          {loading ? "Processing..." : "Login"}
        </motion.button>

        <motion.button
          type="button"
          className="btn-google animated-btn"
          onClick={handleGoogleLogin}
          whileTap={{ scale: 0.95 }}
        >
          Sign in with Google
        </motion.button>

        <button type="button" className="forgot-btn" onClick={handleForgotPassword}>
          Forgot password?
        </button>

        <div className="login-links">
          <p>
            Don’t have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>

      </motion.form>
    </div>
  );
}
