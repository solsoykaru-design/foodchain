import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, Paperclip, Check, X, AlertCircle } from 'lucide-react';

export function AdminTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.getTickets(filter ? { status: filter } : {})
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const openTicket = async (id: number) => {
    const t = await api.getTicket(id);
    setSelected(t);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    await api.addTicketMessage(selected.id, reply);
    setReply('');
    openTicket(selected.id);
  };

  const changeStatus = async (status: string) => {
    await api.updateTicketStatus(selected.id, status);
    openTicket(selected.id);
    load();
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700', closed: 'bg-zinc-100 text-zinc-500',
  };
  const priorityColors: Record<string, string> = {
    low: 'bg-zinc-100 text-zinc-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Тикеты поддержки</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filter === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {s ? { open: 'Открытые', in_progress: 'В работе', resolved: 'Решённые', closed: 'Закрытые' }[s] : 'Все'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          {loading ? (
            <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
          ) : (
            tickets.map(t => (
              <div key={t.id} onClick={() => openTicket(t.id)}
                className={`bg-white border rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition ${selected?.id === t.id ? 'border-orange-400 ring-1 ring-orange-400' : 'border-zinc-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-zinc-900 truncate">{t.subject}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{t.tenant_name || '—'} · {t.user_name || t.user_email}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{t.status}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{t.priority}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900">{selected.subject}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {selected.tenant_name} · {selected.user_name || selected.user_email}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {selected.status !== 'resolved' && (
                      <button onClick={() => changeStatus('resolved')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Решён"><Check size={16} /></button>
                    )}
                    {selected.status !== 'closed' && (
                      <button onClick={() => changeStatus('closed')} className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg transition" title="Закрыть"><X size={16} /></button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                    <button key={s} onClick={() => changeStatus(s)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition ${selected.status === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3 text-sm text-zinc-700 bg-zinc-50 border-b border-zinc-100">
                {selected.description}
              </div>

              <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
                {selected.messages?.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-xl text-sm ${m.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-zinc-50'}`}>
                    {m.is_internal && <span className="text-[11px] font-bold text-amber-600 block mb-1">Внутреннее примечание</span>}
                    <p className="text-zinc-700">{m.message}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">{m.user_name || m.user_email} · {new Date(m.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-zinc-100">
                <div className="flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)}
                    placeholder="Напишите ответ..." className="flex-1 px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    onKeyDown={e => e.key === 'Enter' && sendReply()} />
                  <button onClick={sendReply} className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium px-4 py-2 rounded-xl hover:opacity-90 transition text-sm flex items-center gap-1">
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-center h-64">
              <p className="text-zinc-400 text-sm">Выберите тикет слева</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
