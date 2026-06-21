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

export default function AdminShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  useTheme();

  useEffect(() => {
    const session = localStorage.getItem('foodchain_admin_session');
    if (session && session.startsWith('admin_') && session.length > 10) setIsLoggedIn(true);
    setLoading(false);
  }, []);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    localStorage.removeItem('foodchain_admin_session');
    localStorage.removeItem('foodchain_admin_user');
    setIsLoggedIn(false);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-500">Загрузка...</div></div>;

  return isLoggedIn ? <AdminAppWrapper onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}
