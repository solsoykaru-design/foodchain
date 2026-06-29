import { useState } from 'react';
import * as api from '../../api';

export default function PosAccountingPanel({ shift, darkMode }: { shift: any; darkMode: boolean }) {
  const [format, setFormat] = useState<'1c' | 'moysklad' | 'bitrix24'>('1c');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const exportData = async () => {
    setLoading(true);
    try {
      const q = `?format=${format}&date=${date}${shift ? `&shiftId=${shift.id}` : ''}`;
      const res = await api.request(`/api/pos/accounting/export${q}`);
      setResult(res);
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting-${format}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 ${darkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
      <h2 className="font-bold mb-3">Выгрузка в бухгалтерию</h2>
      <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className="mb-3">
          <label className="text-xs opacity-70">Формат</label>
          <select value={format} onChange={e => setFormat(e.target.value as any)} className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
            <option value="1c">1С</option>
            <option value="moysklad">МойСклад</option>
            <option value="bitrix24">Битрикс24</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="text-xs opacity-70">Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
        </div>
        <button onClick={exportData} disabled={loading} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm">{loading ? 'Выгрузка...' : 'Выгрузить'}</button>
        <button onClick={async () => { setLoading(true); try { const r = await api.request('/api/pos/1c/sync', { method: 'POST' }); setResult(r); } catch (e: any) { alert(e.message); } finally { setLoading(false); } }} disabled={loading} className="w-full mt-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-sm">Синхронизировать с 1С</button>
        {result && (
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1"><span className="text-xs opacity-70">Результат</span><button onClick={download} className="text-xs text-blue-400 underline">Скачать JSON</button></div>
            <pre className={`text-[10px] p-2 rounded-lg overflow-auto max-h-64 ${darkMode ? 'bg-zinc-950' : 'bg-zinc-100'}`}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
