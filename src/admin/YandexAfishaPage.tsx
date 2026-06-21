import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { useTranslation } from 'react-i18next';
import { Calendar, Settings2, BarChart3, Check, X, RefreshCw, Eye, EyeOff, Loader } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = { pending: 'Ожидание', confirmed: 'Подтверждён', cancelled: 'Отменён' };

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  confirmed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export default function YandexAfishaPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'settings' | 'bookings' | 'report'>('settings');
  const [loading, setLoading] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [venueId, setVenueId] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [stats, setStats] = useState<any>(null);
  const [statsFrom, setStatsFrom] = useState('');
  const [statsTo, setStatsTo] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getYandexAfishaSettings();
      setEnabled(data.enabled || false);
      setApiKey(data.api_key || '');
      setVenueId(data.venue_id || '');
    } catch (e) { console.error(e); }
  }, []);

  const loadBookings = useCallback(async (from?: string, to?: string) => {
    setBookingsLoading(true);
    try {
      const params: any = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const data = await api.getYandexAfishaBookings(Object.keys(params).length ? params : undefined);
      setBookings(Array.isArray(data) ? data : data?.items || []);
    } catch (e) { console.error(e); } finally { setBookingsLoading(false); }
  }, []);

  const loadStats = useCallback(async (from?: string, to?: string) => {
    try {
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const data = await api.getYandexAfishaStats(Object.keys(params).length ? params : undefined);
      setStats(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([loadSettings()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'bookings') loadBookings(dateFrom || undefined, dateTo || undefined);
    if (tab === 'report') loadStats(statsFrom || undefined, statsTo || undefined);
  }, [tab]);

  const handleSaveSettings = async () => {
    try {
      await api.updateYandexAfishaSettings({ enabled, api_key: apiKey, venue_id: venueId });
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      await api.testYandexAfishaConnection();
      setTestResult({ ok: true, message: 'Подключение успешно' });
      addToast('Подключение успешно', 'success');
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
      addToast(e.message, 'error');
    } finally { setTestLoading(false); }
  };

  const handleConfirmBooking = async (id: number) => {
    try {
      await api.updateYandexAfishaBookingStatus(id, 'confirmed');
      addToast('Бронирование подтверждено', 'success');
      loadBookings(dateFrom || undefined, dateTo || undefined);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleRejectBooking = async (id: number) => {
    try {
      await api.updateYandexAfishaBookingStatus(id, 'cancelled');
      addToast('Бронирование отклонено', 'success');
      loadBookings(dateFrom || undefined, dateTo || undefined);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleFilterBookings = () => {
    loadBookings(dateFrom || undefined, dateTo || undefined);
  };

  const handleFilterStats = () => {
    loadStats(statsFrom || undefined, statsTo || undefined);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <Calendar size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Яндекс Афиша</h1>
          <p className="text-sm text-zinc-500">Интеграция бронирований через Яндекс Афишу</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit">
        <button onClick={() => setTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'settings' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <Settings2 size={16} /> Настройки
        </button>
        <button onClick={() => setTab('bookings')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'bookings' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <Calendar size={16} /> Бронирования
        </button>
        <button onClick={() => setTab('report')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'report' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <BarChart3 size={16} /> Отчёт
        </button>
      </div>

      {tab === 'settings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-zinc-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Настройки интеграции</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setEnabled(!enabled)} className={`w-11 h-6 rounded-full transition-all relative ${enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${enabled ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Интеграция включена</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API-ключ</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="Введите API-ключ"
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"><Eye size={16} /></button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">ID площадки (Venue ID)</label>
              <input type="text" value={venueId} onChange={e => setVenueId(e.target.value)}
                placeholder="Идентификатор заведения"
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Как получить API-ключ:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Перейдите в <a href="https://partner.yandex.ru/" target="_blank" rel="noopener noreferrer" className="underline">кабинет партнёра Яндекс</a></li>
              <li>Выберите ваше заведение в разделе "Афиша"</li>
              <li>Перейдите в "Настройки" → "API-интеграция"</li>
              <li>Скопируйте API-ключ и укажите ID площадки</li>
            </ol>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleTest} disabled={testLoading}
              className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-2">
              {testLoading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Проверить подключение
            </button>
            {testResult && (
              <span className={`flex items-center gap-1 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? <Check size={14} /> : <X size={14} />}
                {testResult.message}
              </span>
            )}
            <div className="flex-1" />
            <button onClick={handleSaveSettings}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition flex items-center gap-2">
              Сохранить настройки
            </button>
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-zinc-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Бронирования</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              <span className="text-xs text-zinc-400">—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              <button onClick={handleFilterBookings}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 transition flex items-center gap-1">
                <RefreshCw size={12} /> Применить
              </button>
            </div>
          </div>

          {bookingsLoading ? (
            <div className="flex justify-center py-12"><Loader className="w-5 h-5 animate-spin text-blue-500" /></div>
          ) : bookings.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar size={36} className="mx-auto text-zinc-300 mb-3" />
              <p className="text-zinc-400 text-sm">Бронирования не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Время</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Гости</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Имя</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Телефон</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Источник</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr key={b.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{b.date ? new Date(b.date).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{b.time || b.start_time || '—'}</td>
                      <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300">{b.guests || b.guest_count || '—'}</td>
                      <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300">{b.name || b.user_name || '—'}</td>
                      <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300">{b.phone || b.user_phone || '—'}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[b.status] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-zinc-500">{b.source || 'Яндекс Афиша'}</td>
                      <td className="p-3">
                        {b.status === 'pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleConfirmBooking(b.id)}
                              className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition">
                              <Check size={14} />
                            </button>
                            <button onClick={() => handleRejectBooking(b.id)}
                              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-zinc-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Статистика</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input type="date" value={statsFrom} onChange={e => setStatsFrom(e.target.value)}
                className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              <span className="text-xs text-zinc-400">—</span>
              <input type="date" value={statsTo} onChange={e => setStatsTo(e.target.value)}
                className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              <button onClick={handleFilterStats}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 transition flex items-center gap-1">
                <RefreshCw size={12} /> Применить
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Всего бронирований</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats?.total || 0}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Подтверждено</p>
                <p className="text-2xl font-bold text-green-500">{stats?.confirmed || 0}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Отменено</p>
                <p className="text-2xl font-bold text-red-500">{stats?.cancelled || 0}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Конверсия</p>
                <p className="text-2xl font-bold text-blue-500">
                  {stats?.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
