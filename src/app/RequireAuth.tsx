import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from './routes.constants';

function AuthLoading() {
  return (
    <div className="container">
      <p>Loading…</p>
    </div>
  );
}

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (!session) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
