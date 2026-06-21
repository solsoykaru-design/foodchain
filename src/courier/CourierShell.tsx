import { useState, useEffect } from 'react';
import { useTheme } from '../themes/useTheme';
import CourierApp from './CourierApp';
import CourierAuth from './CourierAuth';

export default function CourierShell() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  useTheme();

  useEffect(() => {
    const id = localStorage.getItem('foodchain_courier_id');
    if (id) setIsLoggedIn(true);
    setLoading(false);
  }, []);

  const handleLogin = (id: number, name: string) => {
    localStorage.setItem('foodchain_courier_id', String(id));
    localStorage.setItem('foodchain_courier_name', name);
    setIsLoggedIn(true);
  };
  const handleLogout = () => {
    localStorage.removeItem('foodchain_courier_id');
    localStorage.removeItem('foodchain_courier_name');
    setIsLoggedIn(false);
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-pulse text-zinc-500">Загрузка...</div></div>;

  return isLoggedIn ? <CourierApp onLogout={handleLogout} /> : <CourierAuth onLogin={handleLogin} />;
}
