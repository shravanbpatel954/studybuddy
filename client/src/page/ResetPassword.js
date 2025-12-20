import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import './ResetPassword.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!token || !email) {
      navigate('/login');
    }
  }, [token, email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Enhanced password validation to match backend
    if (password.length < 8) {
      setMessageType('error');
      return setMessage('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      setMessageType('error');
      return setMessage('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      setMessageType('error');
      return setMessage('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      setMessageType('error');
      return setMessage('Password must contain at least one number');
    }
    if (password !== confirm) {
      setMessageType('error');
      return setMessage('Passwords do not match');
    }

    try {
      const apiBase = 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const res = await fetch(`${apiBase}/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setMessageType('success');
        setMessage('Password reset successful! Redirecting...');
        localStorage.setItem('token', data.token);
        setTimeout(() => navigate('/'), 900);
      } else {
        setMessageType('error');
        setMessage(data.error || 'Failed to reset password');
      }
    } catch (e) {
      setMessageType('error');
      setMessage('Network error');
    }
  };

  return (
    <>
      <TopHeader />
      <div className="reset-page">
        <div className="reset-bg-orb orb-1" />
        <div className="reset-bg-orb orb-2" />
        <div className="reset-card">
          <div className="reset-card-header">
            <div className="reset-pill">Secure reset</div>
            <h2>Reset Password</h2>
            {email && <p className="reset-sub">For {email}</p>}
          </div>

          {message && (
            <div className={`reset-alert ${messageType === 'success' ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <form className="reset-form" onSubmit={handleSubmit}>
            <label className="reset-label">New password</label>
            <input
              className="reset-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />

            <label className="reset-label">Confirm password</label>
            <input
              className="reset-input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
            />

            <button type="submit" className="reset-btn">
              Reset password
            </button>
          </form>

          <div className="reset-footnote">
            Keep this tab open while you finish your reset.
          </div>
        </div>
      </div>
    </>
  );
}

export default ResetPassword;
