// Leaderboard endpoints are at /api/leaderboard (not /api/v1/leaderboard)
const API_BASE = process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || 'https://studybuddy-backend-i649.onrender.com';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function fetchLeaderboard(path) {
  try {
    const url = `${API_BASE}${path}`;
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    throw err;
  }
}

export async function fetchTop(limit = 10) {
  try {
    const res = await fetchLeaderboard(`/api/leaderboard?limit=${limit}`);
    console.log('Leaderboard fetchTop response:', res); // Debug log
    return res;
  } catch (err) {
    console.error('Error fetching leaderboard top:', err);
    return { success: false, leaderboard: [] };
  }
}

export async function fetchMyRank() {
  try {
    const res = await fetchLeaderboard('/api/leaderboard/me');
    console.log('Leaderboard fetchMyRank response:', res); // Debug log
    return res;
  } catch (err) {
    console.error('Error fetching my rank:', err);
    return { success: false };
  }
}
