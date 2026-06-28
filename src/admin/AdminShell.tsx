import { useState, useEffect } from 'react';
import { useTheme } from '../themes/useTheme';
import AdminApp, { AdminAppWrapper } from './AdminApp';
import LoginPage from './LoginPage';

export function getAdminUser() {
  try {
    const raw = localStorage.getItem('foodchain_admin_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearAuth() {
  localStorage.removeItem('foodchain_admin_session');
  localStorage.removeItem('foodchain_admin_user');
  localStorage.removeItem('fc_token');
}

export default function AdminShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  useTheme();

  useEffect(() => {
    const session = localStorage.getItem('foodchain_admin_session');
    const token = localStorage.getItem('fc_token');

    if (!session || !session.startsWith('admin_') || session.length <= 10 || !token) {
      setLoading(false);
      return;
    }

    fetch('/api/admin/tenant-settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.ok) setIsLoggedIn(true);
        else clearAuth();
      })
      .catch(() => {
        // Network error (cold start etc.) — allow login attempt
        setIsLoggedIn(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    clearAuth();
    setIsLoggedIn(false);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-500">Загрузка...</div></div>;

  return isLoggedIn ? <AdminAppWrapper onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}
