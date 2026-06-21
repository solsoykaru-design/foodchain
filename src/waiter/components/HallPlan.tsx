import { useState, useMemo } from 'react';
import { AlertTriangle, LayoutDashboard, Search } from 'lucide-react';
import type { Table, DineInCheck, WaiterCall } from '../../types';

interface Props {
  tables: Table[];
  checks: DineInCheck[];
  waiterCalls: WaiterCall[];
  onTableClick: (table: Table) => void;
  onResolveCall: (id: number) => void;
}

export default function HallPlan({ tables, checks, waiterCalls, onTableClick, onResolveCall }: Props) {
  const [searchTable, setSearchTable] = useState('');
  const [filterZone, setFilterZone] = useState<string | null>(null);

  const zones = useMemo(() => [...new Set(tables.map(t => t.zone).filter(Boolean))], [tables]);

  const filteredTables = useMemo(() => {
    let list = tables;
    if (searchTable) {
      const q = searchTable.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    if (filterZone) list = list.filter(t => t.zone === filterZone);
    return list;
  }, [tables, searchTable, filterZone]);

  const getTableStatusEx = (table: Table): 'free' | 'occupied' | 'reserved' | 'bill_requested' => {
    if (table.status === 'reserved') return 'reserved';
    const hasOpenChecks = checks.some(c => c.tableId === table.id && c.status === 'open');
    if (hasOpenChecks) return 'occupied';
    if ((table as any).billRequested) return 'bill_requested';
    return 'free';
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'free': return 'bg-green-500/20 border-green-500 text-green-400';
      case 'occupied': return 'bg-red-500/20 border-red-500 text-red-400';
      case 'reserved': return 'bg-blue-500/20 border-blue-500 text-blue-400';
      case 'bill_requested': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
      default: return 'bg-zinc-800 border-zinc-700 text-zinc-400';
    }
  };

  const statusLabel: Record<string, string> = {
    free: 'Свободен', occupied: 'Занят', reserved: 'Забронирован', bill_requested: 'Ожидает оплату',
  };

  const occupiedCount = tables.filter(t => getTableStatusEx(t) === 'occupied').length;
  const freeCount = tables.filter(t => getTableStatusEx(t) === 'free').length;
  const billCount = tables.filter(t => getTableStatusEx(t) === 'bill_requested').length;

  return (
    <div className="pb-28 px-4 pt-4">
      {/* Top bar: stats */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <LayoutDashboard size={20} className="text-orange-500" /> Зал
        </h2>
        <div className="flex items-center gap-2">
          {waiterCalls.length > 0 && (
            <div className="bg-red-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-bold text-red-400">{waiterCalls.length}</span>
            </div>
          )}
          <div className="flex gap-1.5 text-[10px] font-semibold">
            <span className="text-green-400">{freeCount}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-red-400">{occupiedCount}</span>
            {billCount > 0 && <><span className="text-zinc-600">/</span><span className="text-yellow-400">{billCount}</span></>}
          </div>
        </div>
      </div>

      {/* Waiter calls */}
      {waiterCalls.length > 0 && (
        <div className="mb-4 space-y-2">
          {waiterCalls.map(call => (
            <div key={call.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-sm font-semibold text-white">Стол {call.tableName || call.tableId}</span>
              </div>
              <button onClick={() => onResolveCall(call.id)}
                className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Принять</button>
            </div>
          ))}
        </div>
      )}

      {/* Search + Zone filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-2 ring-1 ring-zinc-800">
          <Search size={16} className="text-zinc-500 flex-shrink-0" />
          <input value={searchTable} onChange={e => setSearchTable(e.target.value)}
            placeholder="Поиск стола..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
        </div>
      </div>

      {/* Zone tabs */}
      {zones.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
          <button onClick={() => setFilterZone(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${!filterZone ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>Все</button>
          {zones.map(zone => (
            <button key={zone} onClick={() => setFilterZone(zone)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filterZone === zone ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>{zone}</button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mb-4 text-[10px] text-zinc-500 font-medium">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Свободен</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Занят</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Счёт</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Бронь</span>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {filteredTables.map(table => {
          const exStatus = getTableStatusEx(table);
          const hasCall = waiterCalls.some(c => c.tableId === table.id || c.tableName === table.name);
          const tableChecks = checks.filter(c => c.tableId === table.id && c.status === 'open');
          return (
            <button key={table.id} onClick={() => onTableClick(table)}
              className={`relative aspect-square rounded-2xl border-2 ${statusColor(exStatus)} flex flex-col items-center justify-center active:scale-95 transition-transform`}>
              {hasCall && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse ring-2 ring-red-500/30" />}
              <span className="text-3xl font-extrabold">{table.name.replace(/[^0-9]/g, '')}</span>
              <span className="text-[10px] font-semibold mt-1 opacity-70">{statusLabel[exStatus]}</span>
              {tableChecks.length > 0 && (
                <span className="text-[9px] mt-0.5 text-orange-400">{tableChecks.reduce((s, c) => s + c.total, 0)}₽</span>
              )}
            </button>
          );
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-16">
          <LayoutDashboard size={48} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 font-semibold">Столы не найдены</p>
        </div>
      )}
    </div>
  );
}
