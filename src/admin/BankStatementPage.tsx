import { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function BankStatementPage() {
  const [txns, setTxns] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, matched: 0, unmatched: 0 });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matchForms, setMatchForms] = useState<Record<number, string>>({});
  const [matchLoading, setMatchLoading] = useState<Record<number, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.getBankStatementSummary(), api.getBankTransactions()]);
      setSummary(s); setTxns(t);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadBankStatement(file);
      addToast(`Импортировано: ${res.imported}, сопоставлено: ${res.matched}, не найдено: ${res.unmatched}`, 'success');
      load();
    } catch (err: any) { addToast(err.message, 'error'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const clearAll = async () => {
    try { await api.clearBankTransactions(); addToast('Очищено', 'success'); load(); }
    catch (err: any) { addToast(err.message, 'error'); }
  };

  const matchTxn = async (id: number) => {
    const orderId = Number(matchForms[id]);
    if (!orderId) return;
    setMatchLoading(m => ({ ...m, [id]: true }));
    try {
      await api.matchBankTransaction(id, orderId);
      addToast('Сопоставлено', 'success');
      setMatchForms(m => ({ ...m, [id]: '' }));
      load();
    } catch (err: any) { addToast(err.message, 'error'); }
    setMatchLoading(m => ({ ...m, [id]: false }));
  };

  const unmatchTxn = async (id: number) => {
    setMatchLoading(m => ({ ...m, [id]: true }));
    try {
      await api.unmatchBankTransaction(id);
      addToast('Сопоставление снято', 'success');
      load();
    } catch (err: any) { addToast(err.message, 'error'); }
    setMatchLoading(m => ({ ...m, [id]: false }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <FileSpreadsheet size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Банковские выписки</h1>
          <p className="text-sm text-zinc-500">Загрузка выписок и сверка с заказами</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Всего транзакций</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Сопоставлено</p>
          <p className="text-2xl font-bold text-emerald-600">{summary.matched}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Не найдено</p>
          <p className="text-2xl font-bold text-amber-600">{summary.unmatched}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:bg-zinc-400">
          {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
          Загрузить выписку (XLSX/CSV)
        </button>
        {summary.total > 0 && (
          <button onClick={clearAll} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <Trash2 size={16} /> Очистить
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Дата</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Описание</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Сумма</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Остаток</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Заказ</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-zinc-400">Загрузка...</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-zinc-400">Нет данных. Загрузите выписку.</td></tr>
              ) : txns.map((t: any) => (
                <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2.5">{t.date}</td>
                  <td className="px-3 py-2.5 max-w-xs truncate">{t.description}</td>
                  <td className={`px-3 py-2.5 font-medium ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{t.amount} ₽</td>
                  <td className="px-3 py-2.5 text-zinc-500">{t.balance != null ? `${t.balance} ₽` : '—'}</td>
                  <td className="px-3 py-2.5">{(t.orderId ?? t.order_id) ? `#${t.orderId ?? t.order_id}` : '—'}</td>
                  <td className="px-3 py-2.5">
                    {(t.orderId ?? t.order_id) ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={14} /> #{t.orderId ?? t.order_id}</span>
                        <button onClick={() => unmatchTxn(t.id)} disabled={matchLoading[t.id]} className="text-xs text-zinc-400 hover:text-red-500">Снять</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="number" placeholder="№ заказа" value={matchForms[t.id] || ''} onChange={e => setMatchForms(m => ({ ...m, [t.id]: e.target.value }))}
                          className="w-24 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs" />
                        <button onClick={() => matchTxn(t.id)} disabled={matchLoading[t.id] || !matchForms[t.id]}
                          className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-lg disabled:opacity-50">Сопоставить</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <strong>Формат файла:</strong> XLSX или CSV с колонками: Дата, Описание, Сумма, Остаток (опционально).
        Первая строка — заголовок. Дата в формате ДД.ММ.ГГГГ или ГГГГ-ММ-ДД.
      </div>
    </div>
  );
}
