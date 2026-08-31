import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5001/api'
    : 'https://srsf-backend.onrender.com/api');

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

// Response interceptor — handle 401 expired session
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a login attempt, pass the error to the form directly without reloading
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('srsf_token');
      localStorage.removeItem('srsf_user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
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
  getCustomers: () => api.get('/bills/customers/list'),
  getById: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  void: (id, reason) => api.patch(`/bills/${id}/void`, { reason }),
  duplicate: (id) => api.post(`/bills/${id}/duplicate`),
  getReminder: (id) => api.get(`/bills/${id}/reminder`),
  updatePaymentStatus: (id, paymentStatus) => api.patch(`/bills/${id}/payment-status`, { paymentStatus }),
  recordPayment: (id, data) => api.post(`/bills/${id}/payments`, data),
  getPayments: (id) => api.get(`/bills/${id}/payments`),
  getPDF: (id) => `${API_BASE_URL}/bills/${id}/pdf?token=${localStorage.getItem('srsf_token')}`,
  exportCSVUrl: (params) => {
    const query = new URLSearchParams(params || {}).toString();
    return `${API_BASE_URL}/bills/export/csv?${query}&token=${localStorage.getItem('srsf_token')}`;
  },
  exportTallyUrl: (params) => {
    const query = new URLSearchParams(params || {}).toString();
    return `${API_BASE_URL}/bills/export/tally?${query}&token=${localStorage.getItem('srsf_token')}`;
  },
};

// Dashboard & Analytics
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary'),
  getDailySummary: () => api.get('/dashboard/daily-summary'),
  getAnalytics: () => api.get('/dashboard/analytics'),
};

// Admin Sales Reports
export const reportsAPI = {
  getSales: (params) => api.get('/reports/sales', { params }),
};

// Admin Customers Directory, Credit Limits & Customer Payments
export const customersAPI = {
  list: (search) => api.get('/customers', { params: { search } }),
  getBills: (name) => api.get(`/customers/${encodeURIComponent(name)}/bills`),
  recordPayment: (name, data) => api.post(`/customers/${encodeURIComponent(name)}/record-payment`, data),
  updateCreditLimit: (name, data) => api.put(`/customers/${encodeURIComponent(name)}/credit-limit`, data),
};

// Admin Activity Audit Logs
export const activityLogsAPI = {
  list: (params) => api.get('/activity-logs', { params }),
};

export default api;
