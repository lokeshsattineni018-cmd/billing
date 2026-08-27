import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('srsf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('srsf_token');
      localStorage.removeItem('srsf_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  seed: (data) => api.post('/auth/seed', data),
  getMe: () => api.get('/auth/me'),
};

// Settings
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Bills / Invoices
export const billsAPI = {
  list: (params) => api.get('/bills', { params }),
  getLedger: () => api.get('/bills/ledger'),
  getById: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  updatePaymentStatus: (id, paymentStatus) => api.patch(`/bills/${id}/payment-status`, { paymentStatus }),
  getPDF: (id) => `${API_BASE_URL}/bills/${id}/pdf?token=${localStorage.getItem('srsf_token')}`,
};

// Dashboard
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary'),
};

export default api;
