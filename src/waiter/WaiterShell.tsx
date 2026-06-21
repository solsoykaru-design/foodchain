import { useState } from 'react';
import { useTheme } from '../themes/useTheme';
import WaiterApp from './WaiterApp';
import WaiterAuth from './WaiterAuth';

export default function WaiterShell() {
  useTheme();
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('foodchain_waiter_user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const tenant = localStorage.getItem('foodchain_tenant');
      if (tenant) u.tenant = JSON.parse(tenant);
      return u;
    } catch { return null; }
  });

  const handleLogin = (userData: any) => {
    localStorage.setItem('foodchain_waiter_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('foodchain_waiter_user');
    localStorage.removeItem('foodchain_waiter_token');
    localStorage.removeItem('foodchain_tenant');
    setUser(null);
  };

  if (!user) return <WaiterAuth onLogin={handleLogin} />;
  return <WaiterApp user={user} onLogout={handleLogout} />;
}
