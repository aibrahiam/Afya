// Protected Route Component

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Guard against the Zustand persist state being out of sync with actual tokens.
  // If there's no access token in localStorage, the user is effectively logged out.
  const hasToken = !!localStorage.getItem('accessToken');

  if (!isAuthenticated || !hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}