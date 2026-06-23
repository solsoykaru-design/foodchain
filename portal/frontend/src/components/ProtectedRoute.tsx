import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { ReactNode } from 'react';

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
