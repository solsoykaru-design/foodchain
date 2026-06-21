import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Clock } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function StaffSchedulePage() {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [staff, setStaff] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ staffId: number; date: string } | null>(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('18:00');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sch] = await Promise.all([
        api.request('/api/staff/schedule-staff').catch(() => []),
        api.request(`/api/staff/schedules?week_start=${formatDate(weekStart)}`).catch(() => []),
      ]);
      setStaff(s);
      setSchedules(sch);
    } catch {}
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const getSchedule = (staffId: number, date: string) =>
    schedules.find((s: any) => s.staffId === staffId && s.date === date);

  const addOrUpdate = async (staffId: number, staffName: string, date: string) => {
    try {
      await api.request('/api/staff/schedules', {
        method: 'POST',
        body: JSON.stringify({ staffId, staffName, date, startTime: editStart, endTime: editEnd }),
      });
      addToast('Сохранено', 'success');
      setEditing(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    try {
      await api.request(`/api/staff/schedules/${id}`, { method: 'DELETE' });
      addToast('Удалено', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <CalendarDays size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">График сотрудников</h1>
            <p className="text-sm text-zinc-500">Планирование смен</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium px-3">
            {days[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {days[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Загрузка...</div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">Нет сотрудников. Добавьте персонал в разделе «Сотрудники».</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 w-40">Сотрудник</th>
                {days.map((d, i) => (
                  <th key={i} className={`px-2 py-2 text-xs font-medium text-center ${d.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-zinc-500'}`}>
                    {DAY_NAMES[i]}<br/>{d.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  {days.map((d, i) => {
                    const dateStr = formatDate(d);
                    const sch = getSchedule(s.id, dateStr);
                    const isEditing = editing?.staffId === s.id && editing?.date === dateStr;
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 items-center">
                            <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                              className="w-16 text-xs border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 bg-transparent" />
                            <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                              className="w-16 text-xs border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 bg-transparent" />
                            <div className="flex gap-1">
                              <button onClick={() => addOrUpdate(s.id, s.name, dateStr)}
                                className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">OK</button>
                              <button onClick={() => setEditing(null)}
                                className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">X</button>
                            </div>
                          </div>
                        ) : sch ? (
                          <div className="group relative inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-lg">
                            <Clock size={12} /> {sch.startTime}-{sch.endTime}
                            <button onClick={() => remove(sch.id)}
                              className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing({ staffId: s.id, date: dateStr }); setEditStart('09:00'); setEditEnd('18:00'); }}
                            className="text-zinc-300 hover:text-blue-500 transition">
                            <Plus size={16} />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
