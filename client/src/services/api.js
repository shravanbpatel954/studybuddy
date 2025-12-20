import { getApiBase } from '../utils/apiConfig';

const BASE = getApiBase();

function buildUrl(path) {
  if (!path) return BASE;
  // allow passing paths with or without leading slash
  return BASE + (path.startsWith('/') ? path : '/' + path);
}

function getToken() {
  return localStorage.getItem('token') || '';
}

async function request(method, path, body = null, opts = {}) {
  try {
    const url = buildUrl(path);
    const headers = Object.assign({}, opts.headers || {});
    // don't add Content-Type for FormData
    if (!(body instanceof FormData) && body != null && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : (body != null ? JSON.stringify(body) : undefined),
    credentials: opts.credentials || 'same-origin',
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      // invalid json
      const text = await res.text();
      throw new Error(text || 'Invalid JSON response');
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = (data && data.error) || data || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    err.raw = data;
    throw err;
  }

  return data;
  } catch (error) {
    // Network errors (CORS, no connection, etc)
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      error.message = 'Unable to connect to server. Please check your connection.';
    }
    
    // Add debugging info
    console.error(`API ${method} ${path} failed:`, { 
      error,
      status: error.status,
      message: error.message,
      raw: error.raw
    });
    
    throw error;
  }
}

export async function get(path, opts) { return request('GET', path, null, opts); }
export async function post(path, body, opts) { return request('POST', path, body, opts); }
export async function patch(path, body, opts) { return request('PATCH', path, body, opts); }
export async function del(path, body, opts) { return request('DELETE', path, body, opts); }
export async function postForm(path, formData, opts) { return request('POST', path, formData, Object.assign({}, opts, { headers: opts?.headers })); }

const api = { get, post, patch, del, postForm, buildUrl, BASE };
export default api;
