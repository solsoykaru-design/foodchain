import { useState } from 'react';
import { useTheme } from '../themes/useTheme';
import ManagerApp from './ManagerApp';
import ManagerAuth from './ManagerAuth';

export default function ManagerShell() {
  useTheme();
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('foodchain_manager_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  });

  const handleLogin = (userData: any) => {
    localStorage.setItem('foodchain_manager_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('foodchain_manager_user');
    localStorage.removeItem('foodchain_token');
    setUser(null);
  };

  if (!user) return <ManagerAuth onLogin={handleLogin} />;
  return <ManagerApp user={user} onLogout={handleLogout} />;
}
