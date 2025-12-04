import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { getApiBase } from "../utils/apiConfig";
import "./Login.css";

function PasswordResetModal({ show, message, onClose }) {
  if (!show) return null;
  return (
    <div className="modal-overlay">
      <div className="custom-modal">
        <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}></div>
        <div style={{ marginBottom: 22 }}>{message}</div>
        <button className="modal-ok-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    let submitFormData = { ...formData };
    if (submitFormData.email)
      submitFormData.email = submitFormData.email.trim().toLowerCase();

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitFormData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        navigate("/dashboard");
      } else {
        setError(data.error || "An error occurred");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try { localStorage.setItem('postLoginRedirect', '/dashboard'); } catch (e) { /* ignore */ }
    // add mode=signin so backend (if needed) can distinguish flows
    const apiBase = getApiBase();
    window.location.href = `${apiBase}/auth/google?mode=signin`;
  };

  const handleForgotPassword = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setIsModalOpen(true);
    } catch {
      setIsModalOpen(true);
    }
  };

  return (
    <div className="login-container">
      <PasswordResetModal
        show={isModalOpen}
        message="If that email exists, a reset link has been sent"
        onClose={() => setIsModalOpen(false)}
      />
      <motion.form
        className="login-card"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        onSubmit={handleSubmit}
      >
  <h2 className="login-title">Login</h2>

        {error && <div className="error-message">{error}</div>}

        {/* Signup handled on separate page */}

        <label>Email:</label>
        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleInputChange}
          required
        />

        <label>Password:</label>
        <input
          type="password"
          name="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleInputChange}
          required
        />

        <motion.button
          type="submit"
          className="btn-login"
          whileHover={{ scale: 1.05, boxShadow: "0 0 15px #00e0ff" }}
          whileTap={{ scale: 0.95 }}
          disabled={loading}
        >
          {loading ? "Processing..." : "Login"}
        </motion.button>

        <motion.button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          whileHover={{ scale: 1.05, boxShadow: "0 0 15px #ff4b4b" }}
          whileTap={{ scale: 0.95 }}
        >
          Sign in with Google
        </motion.button>

        <button type="button" className="forgot-btn" onClick={handleForgotPassword}>
          Forgot password?
        </button>

        <div className="login-links">
          <p>
            Don't have an account?{' '}
            <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </motion.form>
    </div>
  );
}
