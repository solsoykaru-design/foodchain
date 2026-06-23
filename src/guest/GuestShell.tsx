import { useState, useEffect } from 'react';
import { useTheme } from '../themes/useTheme';
import GuestApp from './GuestApp';
import AuthPage from './AuthPage';
import TenantPicker from './TenantPicker';

export default function GuestShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  useTheme();

  useEffect(() => {
    const STORAGE_VERSION = 4;
    const ver = parseInt(localStorage.getItem('fc_storage_version') || '0', 10);
    if (ver < STORAGE_VERSION) {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('foodchain_'));
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
      try {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith('foodchain_'));
        keys.forEach(k => sessionStorage.removeItem(k));
      } catch {}
      sessionStorage.removeItem('foodchain_guest_user');
      localStorage.removeItem('foodchain_guest_user');
      localStorage.removeItem('fc_token');
      localStorage.setItem('fc_storage_version', String(STORAGE_VERSION));
    }
    const user = sessionStorage.getItem('foodchain_guest_user');
    const token = localStorage.getItem('fc_token');
    if (user && token) setIsLoggedIn(true);
    setLoading(false);
  }, []);

  const handleTenantSelect = () => setShowTenantPicker(false);
  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowAuth(false);
  };
  const handleLogout = () => {
    clearAuthData();
    setIsLoggedIn(false);
  };

  const clearAuthData = () => {
    localStorage.removeItem('fc_token');
    sessionStorage.removeItem('foodchain_guest_user');
    localStorage.removeItem('foodchain_guest_user');
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('foodchain_'));
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('foodchain_'));
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch {}
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-500">Загрузка...</div></div>;

  return (
    <>
      {showTenantPicker && <TenantPicker onSelect={handleTenantSelect} onClose={() => setShowTenantPicker(false)} />}
      {showAuth && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <AuthPage onLogin={handleLogin} />
        </div>
      )}
      <GuestApp
        onLogout={handleLogout}
        onLogin={() => setShowAuth(true)}
        isLoggedIn={isLoggedIn}
        onShowTenantPicker={() => setShowTenantPicker(true)}
      />
    </>
  );
}
