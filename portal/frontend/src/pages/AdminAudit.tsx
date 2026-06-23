import { useEffect, useState } from 'react';
import { api, request } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Check, Download, Search, AlertCircle } from 'lucide-react';

export function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    request<any[]>(`/admin/audit${filter ? '?action=' + encodeURIComponent(filter) : ''}`)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const actionLabels: Record<string, string> = {
    'admin.status_changed': 'Изменён статус',
    'admin.subscription_extended': 'Продлена подписка',
    'admin.notes_updated': 'Обновлены заметки',
    'admin.notification_sent': 'Отправлено уведомление',
    'admin.broadcast_sent': 'Рассылка',
    'admin.tenant_created': 'Создан арендатор',
    'admin.tariff_created': 'Создан тариф',
    'admin.tariff_updated': 'Обновлён тариф',
    'admin.tariff_deleted': 'Удалён тариф',
    'admin.modules_updated': 'Обновлены модули',
    'ticket.status_changed': 'Изменён статус тикета',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Журнал аудита</h1>
        <a href={api.adminAuditExport()} download
          className="border border-zinc-300 text-zinc-700 font-medium px-4 py-2 rounded-xl hover:bg-zinc-50 transition text-sm flex items-center gap-2">
          <Download size={16} /> CSV
        </a>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'admin.status_changed', 'admin.subscription_extended', 'admin.tenant_created', 'admin.notification_sent', 'admin.broadcast_sent', 'admin.tariff_created'].map(a => (
          <button key={a} onClick={() => setFilter(a)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filter === a ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {actionLabels[a] || 'Все'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {logs.map((l: any) => (
              <div key={l.id} className="px-5 py-3 text-sm hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-zinc-900">{actionLabels[l.action] || l.action}</span>
                    <span className="text-zinc-400 mx-1.5">·</span>
                    <span className="text-zinc-500">{l.user_email || `#${l.user_id}`}</span>
                    {l.tenant_name && <><span className="text-zinc-400 mx-1.5">·</span><span className="text-zinc-500">{l.tenant_name}</span></>}
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{new Date(l.created_at).toLocaleString('ru-RU')}</span>
                </div>
                {l.details && (
                  <div className="text-xs text-zinc-400 mt-1 truncate">{l.details}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
