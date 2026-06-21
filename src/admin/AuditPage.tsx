import { useState, useEffect } from 'react';
import * as api from '../api';
import { Shield, Search, Clock, User, Monitor } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getAuditLogs().then(setLogs).catch(() => {});
  }, []);

  const filtered = logs.filter((l: any) =>
    l.adminName?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Безопасность</h2>
          <p className="text-sm text-zinc-500 mt-1">Логи действий администраторов</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Администратор</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Действие</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Детали</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log: any) => (
                <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="p-3 text-zinc-400 text-xs whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString('ru') : ''}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 text-zinc-900 dark:text-white font-medium">
                      <User size={14} className="text-zinc-400" /> {log.adminName || '—'}
                    </span>
                  </td>
                  <td className="p-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{log.action}</span></td>
                  <td className="p-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{log.details || '—'}</td>
                  <td className="p-3 text-zinc-400 text-xs">
                    <span className="flex items-center gap-1"><Monitor size={12} /> {log.ip || '—'}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
