/**
 * API Configuration Utility
 * Ensures API base URL is always correctly formatted
 */

export const getApiBase = () => {
  let apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-peach-eight.vercel.app/api/v1';
  
  // Remove trailing slash if present
  apiBase = apiBase.replace(/\/$/, '');
  
  // Ensure it ends with /api/v1
  if (!apiBase.endsWith('/api/v1')) {
    // If it doesn't end with /api/v1, try to add it
    // Remove any existing /api/v1 to avoid duplication
    apiBase = apiBase.replace(/\/api\/v1$/, '');
    // Remove trailing slash before adding /api/v1
    apiBase = apiBase.replace(/\/$/, '');
    apiBase = apiBase + '/api/v1';
  }
  
  return apiBase;
};

export const getSocketUrl = () => {
  // Socket URL should be the base URL without /api/v1
  const socketUrl = process.env.REACT_APP_SOCKET_URL;
  if (socketUrl) {
    return socketUrl.replace(/\/$/, '');
  }
  
  // Fallback: derive from API base
  const apiBase = getApiBase();
  return apiBase.replace(/\/api\/v1$/, '');
};

