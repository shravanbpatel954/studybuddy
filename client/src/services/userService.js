import axios from 'axios';

export async function getUserPoints() {
  try {
    const token = localStorage.getItem('token') || '';
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
    const res = await axios.get(`${apiBase.replace('/api/v1', '')}/api/user/points`, { headers });
    console.log('Points response:', res.data); // Debug log
    return res.data;
  } catch (err) {
    console.error('Failed to fetch points:', err); // Debug log
    return { success: false, points: 0 };
  }
}
