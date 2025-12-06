import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopHeader from '../components/TopHeader';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!token || !email) {
      navigate('/login');
    }
  }, [token, email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setMessage('Password must be at least 6 characters');
    if (password !== confirm) return setMessage('Passwords do not match');

    try {
      const apiBase = 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const res = await fetch(`${apiBase}/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        navigate('/');
      } else {
        setMessage(data.error || 'Failed to reset password');
      }
    } catch (e) {
      setMessage('Network error');
    }
  };

  return (
    <>
      <TopHeader />
      <div style={{ maxWidth: '420px', margin: '60px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2 style={{ textAlign: 'center' }}>Reset Password</h2>
      {message && <div style={{ color: 'red', marginBottom: 10 }}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>New password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: 10, background: '#007bff', color: '#fff', border: 'none' }}>Reset password</button>
      </form>
      </div>
    </>
  );
}

export default ResetPassword;
