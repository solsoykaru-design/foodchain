import { useState, useEffect } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import * as api from '../../../api';

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: { value: string; label: string }[];
}

interface ReportFiltersProps {
  from: string;
  to: string;
  branchId?: number;
  onChange: (filters: { from: string; to: string; branchId?: number; custom: Record<string, string> }) => void;
  extraFilters?: FilterConfig[];
}

export default function ReportFilters({ from: initialFrom, to: initialTo, branchId: initialBranch, onChange, extraFilters }: ReportFiltersProps) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [branchId, setBranchId] = useState<number | undefined>(initialBranch);
  const [branches, setBranches] = useState<any[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/api/branches').then(setBranches).catch(() => {});
  }, []);

  const handleApply = () => {
    onChange({ from, to, branchId, custom });
  };

  const handleReset = () => {
    setFrom('');
    setTo('');
    setBranchId(undefined);
    setCustom({});
    onChange({ from: '', to: '', branchId: undefined, custom: {} });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">От</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">До</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Филиал</label>
          <select value={branchId ?? ''} onChange={e => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-w-[160px]">
            <option value="">Все филиалы</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {extraFilters?.map(fc => (
          <div key={fc.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{fc.label}</label>
            {fc.type === 'select' && fc.options ? (
              <select value={custom[fc.key] ?? ''} onChange={e => setCustom(c => ({ ...c, [fc.key]: e.target.value }))}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-w-[140px]">
                <option value="">Все</option>
                {fc.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type="text" value={custom[fc.key] ?? ''} onChange={e => setCustom(c => ({ ...c, [fc.key]: e.target.value }))}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all min-w-[140px]" />
            )}
          </div>
        ))}
        <button onClick={handleApply}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97]">
          <Filter size={14} />
          Применить
        </button>
        <button onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-all active:scale-[0.97]">
          <RotateCcw size={14} />
          Сброс
        </button>
      </div>
    </div>
  );
}
