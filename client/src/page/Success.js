import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Success = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token') || '';
    if (token) {
      localStorage.setItem('token', token);
      // Check for post-login redirect
      const redirect = localStorage.getItem('postLoginRedirect') || '/dashboard';
      localStorage.removeItem('postLoginRedirect');
      // Add a small delay to show success message
      setTimeout(() => {
        navigate(redirect);
      }, 1000);
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column'
    }}>
      <h2>Login Successful!</h2>
      <p>Redirecting to dashboard...</p>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginTop: '20px'
      }}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Success;
