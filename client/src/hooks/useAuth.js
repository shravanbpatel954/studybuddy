import { useEffect, useState, useCallback } from 'react';

export default function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') || {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    try {
      if (user && Object.keys(user).length) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
    } catch (e) {}
  }, [user]);

  const login = useCallback((newToken, userObj) => {
    setToken(newToken || '');
    if (userObj) setUser(userObj);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser({});
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('userId'); } catch (e) {}
  }, []);

  return { token, setToken, user, setUser, login, logout };
}
