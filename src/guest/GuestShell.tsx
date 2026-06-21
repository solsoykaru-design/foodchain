import { useState, useEffect } from 'react';
import { useTheme } from '../themes/useTheme';
import GuestApp from './GuestApp';
import AuthPage from './AuthPage';
import TenantPicker from './TenantPicker';

export default function GuestShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [tenantSelected, setTenantSelected] = useState(!!localStorage.getItem('foodchain_guest_tenant'));
  const [loading, setLoading] = useState(true);
  useTheme();

  useEffect(() => {
    const user = localStorage.getItem('foodchain_guest_user');
    if (user) setIsLoggedIn(true);
    setLoading(false);
  }, []);

  const handleTenantSelect = () => setTenantSelected(true);
  const handleLogin = () => setIsLoggedIn(true);
  const handleSkipAuth = () => {
    localStorage.setItem('foodchain_guest_user', JSON.stringify({ phone: '', name: 'Гость' }));
    setSkipAuth(true);
    setIsLoggedIn(true);
  };
  const handleLogout = () => {
    localStorage.removeItem('foodchain_guest_user');
    setIsLoggedIn(false);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-500">Загрузка...</div></div>;
  if (!tenantSelected) return <TenantPicker onSelect={handleTenantSelect} />;
  return isLoggedIn ? <GuestApp onLogout={handleLogout} /> : <AuthPage onLogin={handleLogin} onSkip={handleSkipAuth} />;
}
