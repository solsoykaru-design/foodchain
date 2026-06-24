import { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Shield } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('foodchain_admin_user') || '{}');
      setUser(u);
    } catch {}
  }, []);
  if (!user) return <div className="text-zinc-400 p-4">Загрузка...</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Мой профиль</h1>
      <div className="max-w-md bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <User size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white">{user.name || user.firstName || user.username || '—'}</p>
            <p className="text-sm text-zinc-500">{user.role}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Mail size={14} /> {user.email || '—'}</div>
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Phone size={14} /> {user.phone || '—'}</div>
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Shield size={14} /> Роль: {user.role}</div>
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Calendar size={14} /> ID: {user.id}</div>
        </div>
      </div>
    </div>
  );
}
