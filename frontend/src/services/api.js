import axios from 'axios';
import { store } from '../store';
import { logout } from '../store';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 15 * 60 * 1000 // 15 minutes for large file processing
});

// Attach JWT token to every request
API.interceptors.request.use(config => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 - auto logout
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      store.dispatch(logout());
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ---- AUTH ----
export const authAPI = {
  login: (email, password) =>
    API.post('/auth/login', { email, password }),
  me: () => API.get('/auth/me'),
  logout: () => API.post('/auth/logout'),
  register: (data) => API.post('/auth/register', data)
};

// ---- UPLOAD ----
export const uploadAPI = {
  uploadFile: (formData, onProgress) =>
    API.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        const pct = Math.round((e.loaded * 100) / e.total);
        if (onProgress) onProgress(pct);
      }
    }),
  getHistory: () => API.get('/upload/history')
};

// ---- ANALYSIS ----
export const analysisAPI = {
  getResults: (uploadId, params) =>
    API.get(`/analysis/${uploadId}`, { params }),
  getStats: (uploadId) =>
    API.get(`/analysis/${uploadId}/stats`),
  getTransaction: (uploadId, txId) =>
    API.get(`/analysis/${uploadId}/transaction/${txId}`)
};

// ---- GRAPH ----
export const graphAPI = {
  getGraph: (uploadId, params) =>
    API.get(`/graph/${uploadId}`, { params }),
  traceAccount: (uploadId, accountId, depth) =>
    API.get(`/graph/${uploadId}/trace/${accountId}`, { params: { depth } })
};

// ---- REPORTS ----
export const reportsAPI = {
  generate: async (uploadId) => {
    const response = await API.post(`/reports/generate/${uploadId}`, {}, {
      responseType: 'blob'
    });
    // Auto-download PDF
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DeepGuard_Report_${uploadId}_${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  getHistory: () => API.get('/reports/history')
};

// ---- DASHBOARD ----
export const dashboardAPI = {
  getSummary: () => API.get('/dashboard/summary')
};

// ---- ADMIN ----
export const adminAPI = {
  getUsers: () => API.get('/admin/users'),
  updateRole: (userId, role) => API.put(`/admin/users/${userId}/role`, { role }),
  deleteUser: (userId) => API.delete(`/admin/users/${userId}`),
  getLogs: (params) => API.get('/admin/logs', { params }),
  getSystemStats: () => API.get('/admin/system-stats')
};

export default API;
