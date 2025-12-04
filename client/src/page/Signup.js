import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import TopHeader from "../components/TopHeader";
import { getApiBase } from "../utils/apiConfig";
import "./Signup.css";

export default function Signup() {
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const response = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        navigate("/dashboard");
      } else {
        setError(data.error || "Error creating account");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    // Mark desired post-auth redirect so the client can navigate after OAuth completes
    try { localStorage.setItem('postLoginRedirect', '/dashboard'); } catch (e) { /* ignore */ }
    // add mode=signup so backend (if needed) can distinguish flows
    const apiBase = getApiBase();
    window.location.href = `${apiBase}/auth/google?mode=signup`;
  };

  return (
    <div className="signup-container">
      <TopHeader />
      <motion.form
        className="signup-card"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        onSubmit={handleSubmit}
      >
        <h2 className="signup-title">Sign Up</h2>

        {error && <div className="error-message">{error}</div>}

        <label>Display Name:</label>
        <input
          type="text"
          name="displayName"
          placeholder="Enter your name"
          value={formData.displayName}
          onChange={handleInputChange}
          required
        />

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
          className="btn-signup"
          whileHover={{ scale: 1.05, boxShadow: "0 0 15px #00e0ff" }}
          whileTap={{ scale: 0.95 }}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </motion.button>

        <motion.button
          type="button"
          className="btn-google"
          onClick={handleGoogleSignup}
          whileHover={{ scale: 1.05, boxShadow: "0 0 15px #ff4b4b" }}
          whileTap={{ scale: 0.95 }}
        >
          Sign up with Google
        </motion.button>

        <div className="signup-links">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="toggle-link">
              Login
            </Link>
          </p>
        </div>
      </motion.form>
    </div>
  );
}
