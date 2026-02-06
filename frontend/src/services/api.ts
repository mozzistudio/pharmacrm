import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '../store/auth';

const API_BASE = '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired token)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          useAuthStore.getState().setToken(data.data.token);
          // Retry original request
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.data.token}`;
            return api.request(error.config);
          }
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── API Functions ─────────────────────────────────────────────

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// HCPs
export const hcpApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/hcps', { params }),
  getById: (id: string) =>
    api.get(`/hcps/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/hcps', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/hcps/${id}`, data),
  delete: (id: string) =>
    api.delete(`/hcps/${id}`),
  getInteractions: (id: string) =>
    api.get(`/hcps/${id}/interactions`),
  getConsents: (id: string) =>
    api.get(`/hcps/${id}/consents`),
  recordConsent: (id: string, data: Record<string, unknown>) =>
    api.post(`/hcps/${id}/consents`, data),
  getAIScores: (id: string) =>
    api.get(`/hcps/${id}/ai-scores`),
};

// Engagement
export const engagementApi = {
  listInteractions: (params?: Record<string, unknown>) =>
    api.get('/engagement/interactions', { params }),
  createInteraction: (data: Record<string, unknown>) =>
    api.post('/engagement/interactions', data),
  updateInteraction: (id: string, data: Record<string, unknown>) =>
    api.patch(`/engagement/interactions/${id}`, data),
  listTasks: (params?: Record<string, unknown>) =>
    api.get('/engagement/tasks', { params }),
  createTask: (data: Record<string, unknown>) =>
    api.post('/engagement/tasks', data),
  updateTask: (id: string, data: Record<string, unknown>) =>
    api.patch(`/engagement/tasks/${id}`, data),
};

// Field Force
export const fieldForceApi = {
  createVisitPlan: (data: Record<string, unknown>) =>
    api.post('/field-force/visit-plans', data),
  getVisitPlans: (params?: Record<string, unknown>) =>
    api.get('/field-force/visit-plans', { params }),
  getVisitSuggestions: (date?: string) =>
    api.get('/field-force/visit-suggestions', { params: { date } }),
  syncOffline: (data: Record<string, unknown>) =>
    api.post('/field-force/sync', data),
};

// Analytics
export const analyticsApi = {
  getDashboard: (period?: string) =>
    api.get('/analytics/dashboard', { params: { period } }),
  getTerritoryPerformance: (period?: string) =>
    api.get('/analytics/territory-performance', { params: { period } }),
  getEngagementTrends: (period?: string) =>
    api.get('/analytics/engagement-trends', { params: { period } }),
  generateReport: (data: Record<string, unknown>) =>
    api.post('/analytics/reports', data),
};

// AI Intelligence
export const aiApi = {
  getEngagementScore: (hcpId: string) =>
    api.post(`/ai/scoring/engagement/${hcpId}`),
  getNextBestAction: (hcpId: string) =>
    api.post(`/ai/nba/${hcpId}`),
  getPendingNBAs: () =>
    api.get('/ai/nba/pending'),
  respondToNBA: (id: string, response: string, reason?: string) =>
    api.post(`/ai/nba/${id}/respond`, { response, reason }),
  getAccountSummary: (hcpId: string) =>
    api.get(`/ai/summary/${hcpId}`),
  sendCopilotMessage: (data: { conversationId?: string; message: string; context?: Record<string, unknown> }) =>
    api.post('/ai/copilot/chat', data),
};

// Compliance
export const complianceApi = {
  getAuditLog: (params?: Record<string, unknown>) =>
    api.get('/compliance/audit-log', { params }),
  getConsentHistory: (hcpId: string) =>
    api.get(`/compliance/consents/${hcpId}/history`),
  getDataSubjectReport: (hcpId: string) =>
    api.get(`/compliance/gdpr/data-subject-report/${hcpId}`),
  getDashboard: () =>
    api.get('/compliance/dashboard'),
};

// Omnichannel
export const omnichannelApi = {
  listCampaigns: (status?: string) =>
    api.get('/omnichannel/campaigns', { params: { status } }),
  createCampaign: (data: Record<string, unknown>) =>
    api.post('/omnichannel/campaigns', data),
  approveCampaign: (id: string) =>
    api.post(`/omnichannel/campaigns/${id}/approve`),
  getChannelRecommendation: (hcpId: string) =>
    api.get(`/omnichannel/channel-recommendation/${hcpId}`),
};

// Integrations
export const integrationApi = {
  listWebhooks: () => api.get('/integrations/webhooks'),
  createWebhook: (data: Record<string, unknown>) =>
    api.post('/integrations/webhooks', data),
  listImports: (status?: string) =>
    api.get('/integrations/imports', { params: { status } }),
  createImport: (data: Record<string, unknown>) =>
    api.post('/integrations/imports', data),
};
