// API Service for backend communication

import axios, { AxiosResponse } from 'axios';
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
export const BACKEND_BASE_URL = API_BASE_URL.replace('/api/v1', '');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed — clear both localStorage AND the Zustand store,
          // otherwise isAuthenticated stays true and causes a redirect loop.
          await useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        // No refresh token — clear store state and redirect to login
        await useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/login', credentials),

  refresh: (refreshToken: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/refresh', { refreshToken }),

  getProfile: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/auth/me'),

  logout: (refreshToken?: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/logout', { refreshToken }),
};

// Cases API
export const casesApi = {
  getCases: (params?: {
    status?: string;
    priority?: string;
    scanType?: string;
    page?: number;
    limit?: number;
  }): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/cases', { params }),

  getCaseById: (caseId: string): Promise<AxiosResponse<ApiResponse>> =>
    api.get(`/cases/${caseId}`),

  getCaseAnalysis: (caseId: string): Promise<AxiosResponse<ApiResponse>> =>
    api.get(`/cases/${caseId}/analysis`),

  updateCaseStatus: (caseId: string, status: string): Promise<AxiosResponse<ApiResponse>> =>
    api.patch(`/cases/${caseId}/status`, { status }),

  submitFeedback: (
    caseId: string,
    feedback: {
      rating: 'accurate' | 'needs_review' | 'incorrect';
      correctionText?: string;
      findingId?: string;
      correctedSeverity?: string;
    }
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/cases/${caseId}/analysis/feedback`, feedback),

  getStatistics: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/cases/stats'),

  createCase: (formData: FormData): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/cases', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  triggerAnalysis: (caseId: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/cases/${caseId}/analyze`),

  deleteCase: (caseId: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/cases/${caseId}`),

  updateCase: (
    caseId: string,
    data: {
      patientName?: string;
      age?: number;
      gender?: string;
      scanType?: string;
      bodyPart?: string;
      clinicalHistory?: string;
      referringPhysician?: string;
      priority?: string;
    }
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.patch(`/cases/${caseId}`, data),
};

// System API
export const systemApi = {
  getHealth: (): Promise<AxiosResponse<ApiResponse>> =>
    api.get('/system/health'),
};

export default api;