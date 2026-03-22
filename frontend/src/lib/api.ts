import axios from 'axios';

/** Production: set VITE_API_URL to your API origin, e.g. https://api.yourdomain.com (no trailing slash). Dev: leave unset to use Vite proxy. */
const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nf_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

