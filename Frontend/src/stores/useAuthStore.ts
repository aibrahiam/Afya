// Authentication Store using Zustand

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { authApi } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  licenseNumber?: string;
  avatarInitials?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  casesReviewedToday?: number;
  totalCases?: number;
  pendingCases?: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          
          try {
            const response = await authApi.login({ email, password });
            const { user, accessToken, refreshToken } = response.data.data;

            // Store tokens in localStorage for axios interceptor
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || 'Login failed';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw new Error(errorMessage);
          }
        },

        logout: async () => {
          const { refreshToken } = get();
          
          try {
            if (refreshToken) {
              await authApi.logout(refreshToken);
            }
          } catch (error) {
            // Continue with logout even if API call fails
            console.warn('Logout API call failed:', error);
          }

          // Clear tokens from localStorage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          });
        },

        refreshProfile: async () => {
          const { isAuthenticated } = get();
          
          if (!isAuthenticated) return;

          try {
            const response = await authApi.getProfile();
            const userData = response.data.data;

            set({
              user: userData,
              error: null,
            });
          } catch (error: any) {
            console.error('Failed to refresh profile:', error);
            // Don't logout on profile refresh failure
          }
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: 'afyadx-auth',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);