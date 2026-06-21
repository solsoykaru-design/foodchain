import { useState, useEffect } from 'react';
import { Save, Power, PowerOff, Wifi, Activity, Clock, CheckCircle2, XCircle, AlertCircle, Search, Filter } from 'lucide-react';
import * as api from '../api';

const PROVIDERS = [
  { value: 'inpas', label: 'INPAS SmartSale' },
  { value: 'sber', label: 'Сбербанк Эквайринг' },
  { value: 'atol', label: 'Атол (драйвер)' },
  { value: 'verifone', label: 'Verifone' },
];

export default function TerminalSettingsPage() {
  const [tab, setTab] = useState<'settings' | 'transactions' | 'logs'>('settings');
  const [settings, setSettings] = useState<any>({
    provider: 'inpas', ip: '192.168.1.100', port: 8000,
    terminalId: '', login: '', password: '', enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [txFilter, setTxFilter] = useState('');
  const [logFilter, setLogFilter] = useState('');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/terminal/settings');
      setSettings(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await api.put('/api/admin/terminal/settings', settings);
      setSettings(data);
      setMessage('Настройки сохранены');
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await api.post('/api/admin/terminal/test');
      setTestResult(data);
    } catch (e: any) { setError(e.message); }
    setTesting(false);
  };

  const loadTransactions = async (page = 1) => {
    setTxPage(page);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (txFilter) params.set('status', txFilter);
      const data = await api.get(`/api/admin/terminal/transactions?${params}`);
      setTransactions(data.items || []);
      setTxTotal(data.total || 0);
    } catch {}
  };

  const loadLogs = async (page = 1) => {
    setLogPage(page);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (logFilter) params.set('operation', logFilter);
      const data = await api.get(`/api/admin/terminal/logs?${params}`);
      setLogs(data.items || []);
      setLogTotal(data.total || 0);
    } catch {}
  };

  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, txFilter]);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, logFilter]);

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-500',
    success: 'bg-emerald-500/20 text-emerald-500',
    error: 'bg-red-500/20 text-red-500',
    cancelled: 'bg-zinc-500/20 text-zinc-500',
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Ожидание', success: 'Успешно', error: 'Ошибка', cancelled: 'Отменён',
  };

  if (loading) {
    return <div className="text-center py-12 text-zinc-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Эквайринг (POS-терминалы)</h2>
          <p className="text-sm text-zinc-500 mt-1">Настройка интеграции с банковскими терминалами</p>
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
          <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'settings' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
            Настройки
          </button>
          <button onClick={() => setTab('transactions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'transactions' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
            Транзакции
          </button>
          <button onClick={() => setTab('logs')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'logs' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
            Логи
          </button>
        </div>
      </div>

      {message && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><CheckCircle2 size={16} /> {message}</div>}
      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

      {tab === 'settings' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            <button onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <div>
              <p className="font-semibold text-sm text-zinc-900 dark:text-white">{settings.enabled ? 'Терминал включён' : 'Терминал отключён'}</p>
              <p className="text-xs text-zinc-500">{settings.enabled ? 'Оплата через терминал доступна' : 'Кнопка оплаты скрыта у официантов'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Тип терминала</label>
              <select value={settings.provider} onChange={e => setSettings({ ...settings, provider: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">IP-адрес терминала</label>
              <input value={settings.ip} onChange={e => setSettings({ ...settings, ip: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Порт</label>
              <input type="number" value={settings.port} onChange={e => setSettings({ ...settings, port: Number(e.target.value) })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Terminal ID</label>
              <input value={settings.terminalId || ''} onChange={e => setSettings({ ...settings, terminalId: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Логин</label>
              <input value={settings.login || ''} onChange={e => setSettings({ ...settings, login: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Пароль</label>
              <input type="password" value={settings.password || ''} onChange={e => setSettings({ ...settings, password: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <button onClick={test} disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
              {testing ? <Activity size={16} className="animate-spin" /> : <Wifi size={16} />}
              {testing ? 'Проверка...' : 'Проверить подключение'}
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border text-sm ${testResult.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'}`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {testResult.ok ? 'Терминал доступен' : 'Ошибка подключения'}
              </div>
              {testResult.error && <p className="text-xs opacity-80">{testResult.error}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
              className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800">
              <option value="">Все статусы</option>
              <option value="success">Успешные</option>
              <option value="error">Ошибки</option>
              <option value="pending">Ожидание</option>
              <option value="cancelled">Отменённые</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 text-xs">
                  <th className="pb-2 font-medium">ID транзакции</th>
                  <th className="pb-2 font-medium">Заказ</th>
                  <th className="pb-2 font-medium">Сумма</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">RRN</th>
                  <th className="pb-2 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.transaction_id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2.5 text-xs font-mono text-zinc-500">{tx.transaction_id?.slice(0, 20)}...</td>
                    <td className="py-2.5 font-medium">#{tx.order_id}</td>
                    <td className="py-2.5">{tx.amount}₽</td>
                    <td className="py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[tx.status] || 'bg-zinc-500/20 text-zinc-500'}`}>
                        {STATUS_LABEL[tx.status] || tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-zinc-500 font-mono">{tx.rrn || '-'}</td>
                    <td className="py-2.5 text-xs text-zinc-500">{tx.created_at ? new Date(tx.created_at + 'Z').toLocaleString('ru-RU') : '-'}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-zinc-400">Нет транзакций</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {txTotal > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={txPage <= 1} onClick={() => loadTransactions(txPage - 1)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm disabled:opacity-50">Назад</button>
              <span className="px-3 py-1.5 text-sm text-zinc-500">{txPage} / {Math.ceil(txTotal / 20)}</span>
              <button disabled={txPage >= Math.ceil(txTotal / 20)} onClick={() => loadTransactions(txPage + 1)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm disabled:opacity-50">Вперёд</button>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <select value={logFilter} onChange={e => setLogFilter(e.target.value)}
              className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800">
              <option value="">Все операции</option>
              <option value="init">Инициализация</option>
              <option value="cancel">Отмена</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 text-xs">
                  <th className="pb-2 font-medium">Время</th>
                  <th className="pb-2 font-medium">Операция</th>
                  <th className="pb-2 font-medium">Заказ</th>
                  <th className="pb-2 font-medium">Сумма</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 font-medium">Ошибка</th>
                  <th className="pb-2 font-medium">RRN</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 text-xs">
                    <td className="py-2 text-zinc-500">{log.created_at ? new Date(log.created_at + 'Z').toLocaleString('ru-RU') : '-'}</td>
                    <td className="py-2 font-medium">{log.operation}</td>
                    <td className="py-2">#{log.order_id || '-'}</td>
                    <td className="py-2">{log.amount}₽</td>
                    <td className="py-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[log.status] || 'bg-zinc-500/20 text-zinc-500'}`}>
                        {STATUS_LABEL[log.status] || log.status}
                      </span>
                    </td>
                    <td className="py-2 text-red-400 max-w-[200px] truncate">{log.error_message || '-'}</td>
                    <td className="py-2 text-zinc-500 font-mono">{log.rrn || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-zinc-400">Нет логов</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {logTotal > 30 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={logPage <= 1} onClick={() => loadLogs(logPage - 1)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm disabled:opacity-50">Назад</button>
              <span className="px-3 py-1.5 text-sm text-zinc-500">{logPage} / {Math.ceil(logTotal / 30)}</span>
              <button disabled={logPage >= Math.ceil(logTotal / 30)} onClick={() => loadLogs(logPage + 1)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm disabled:opacity-50">Вперёд</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
