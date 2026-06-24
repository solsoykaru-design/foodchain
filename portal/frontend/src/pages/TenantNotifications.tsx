import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Info, AlertTriangle, Shield, Wrench, Calendar } from 'lucide-react';
import { api } from '../api/client';

const typeIcons: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  billing: Shield,
  maintenance: Wrench,
};

const typeColors: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  billing: 'text-green-400 bg-green-500/10',
  maintenance: 'text-purple-400 bg-purple-500/10',
};

export default function TenantNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.getMyNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {} finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      try { await api.markNotificationRead(n.id); } catch {}
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a192f]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell size={24} className="text-cyan-400" /> Уведомления
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Нет непрочитанных'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-sm text-slate-300 transition">
              <CheckCheck size={16} /> Прочитать все
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-500">Нет уведомлений</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = typeIcons[n.type] || Info;
              const colorClass = typeColors[n.type] || typeColors.info;
              return (
                <div key={n.id}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                  className={`rounded-2xl p-4 cursor-pointer transition border ${
                    n.is_read
                      ? 'bg-white/5 border-white/5 hover:bg-white/[0.07]'
                      : 'bg-cyan-500/5 border-cyan-500/10 hover:bg-cyan-500/[0.07]'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm ${n.is_read ? 'text-slate-300' : 'text-white font-semibold'}`}>
                          {n.subject}
                        </h3>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-cyan-400 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{n.body}</p>
                      <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                        <Calendar size={10} />
                        {n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
