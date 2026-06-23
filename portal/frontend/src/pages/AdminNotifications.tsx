import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Bell, CheckCircle, AlertTriangle, CreditCard, Wrench } from 'lucide-react';

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendAll, setShowSendAll] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '', type: 'info' });

  const load = () => {
    setLoading(true);
    api.adminGetAllNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSendAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Отправить "${form.subject}" всем арендаторам?`)) return;
    try {
      const tenants = await api.adminGetTenants({ status: 'active' });
      for (const t of tenants) {
        await api.adminNotifyTenant(t.id, form.subject, form.body, form.type);
      }
      setShowSendAll(false);
      setForm({ subject: '', body: '', type: 'info' });
      load();
      alert(`Уведомление отправлено ${tenants.length} арендаторам`);
    } catch {}
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Bell size={14} className="text-blue-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      case 'billing': return <CreditCard size={14} className="text-purple-500" />;
      case 'maintenance': return <Wrench size={14} className="text-zinc-500" />;
      default: return <Bell size={14} className="text-zinc-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Уведомления арендаторам</h1>
          <p className="text-zinc-500 text-sm mt-0.5">История отправленных уведомлений</p>
        </div>
        <button onClick={() => setShowSendAll(true)} className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          <Bell size={16} /> Отправить всем
        </button>
      </div>

      {showSendAll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSendAll(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Уведомление всем арендаторам</h2>
              <button onClick={() => setShowSendAll(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSendAll} className="space-y-3">
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required placeholder="Тема" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} required placeholder="Текст" rows={4} className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
                <option value="info">Информация</option>
                <option value="warning">Предупреждение</option>
                <option value="billing">Оплата</option>
                <option value="maintenance">Техработы</option>
              </select>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">Отправить всем</button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Нет отправленных уведомлений</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{n.subject}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      n.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                      n.type === 'billing' ? 'bg-purple-100 text-purple-700' :
                      n.type === 'maintenance' ? 'bg-zinc-100 text-zinc-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>{n.type}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{n.body}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-400">
                    <span>{n.tenant_name}</span>
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
