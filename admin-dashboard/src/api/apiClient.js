// src/api/apiClient.js
import axios from 'axios';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

const apiClient = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// simple map to avoid spamming same error repeatedly
const loggedUrls = new Set();

apiClient.interceptors.request.use((config) => {
  const url = config.url || '';
  // attach token for everything except login/register
  if (!url.includes('/login') && !url.includes('/register')) {
    const token = localStorage.getItem('token');
    if (token && typeof token === 'string' && token.split('.').length === 3) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const out = {
      url: err.config?.url,
      status: err.response?.status,
      message: err.message,
      data: err.response?.data,
    };

    // Log each failing URL once to reduce noise
    if (!loggedUrls.has(out.url)) {
      loggedUrls.add(out.url);
      console.error('API request failed:', out);
    }

    const normalized = new Error(out.message || 'API error');
    normalized.url = out.url;
    normalized.status = out.status;
    normalized.data = out.data;
    return Promise.reject(normalized);
  }
);

export default apiClient;
