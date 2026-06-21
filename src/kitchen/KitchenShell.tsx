import { useState } from 'react';
import { useTheme } from '../themes/useTheme';
import KitchenApp from './KitchenApp';
import KitchenAuth from './KitchenAuth';

export default function KitchenShell() {
  useTheme();
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('foodchain_kitchen_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleLogin = (userData: any) => {
    localStorage.setItem('foodchain_kitchen_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('foodchain_kitchen_user');
    localStorage.removeItem('foodchain_kitchen_token');
    setUser(null);
  };

  if (!user) return <KitchenAuth onLogin={handleLogin} />;
  return <KitchenApp user={user} onLogout={handleLogout} />;
}
