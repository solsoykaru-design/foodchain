import { useMemo, useState } from 'react';
import { LayoutDashboard, MoreVertical, ArrowRightLeft, X, Merge, Calendar } from 'lucide-react';

interface Table {
  id: number;
  name: string;
  zone?: string;
  capacity?: number;
  x?: number;
  y?: number;
  color?: string;
  shape?: string;
  isActive?: number;
  status?: string;
}

interface Order {
  id: number;
  tableId?: number;
  status?: string;
  total?: number;
  userName?: string;
}

interface Props {
  tables: Table[];
  orders: Order[];
  bookings?: any[];
  darkMode: boolean;
  onTableClick: (table: Table) => void;
  onStatusChange?: (tableId: number, status: string) => void;
  onTransfer?: (fromTableId: number, toTableId: number) => void;
  onMerge?: (fromOrderId: number, toOrderId: number) => void;
  onBook?: (tableId: number, data: { user_name: string; user_phone: string; date: string; time: string; guest_count: number; comment: string }) => void;
}

const STATUSES = ['free', 'occupied', 'reserved', 'bill_requested', 'cleaning'] as const;

export default function PosHallPlan({ tables, orders, bookings = [], darkMode, onTableClick, onStatusChange, onTransfer, onMerge, onBook }: Props) {
  const activeStatuses = useMemo(() => new Set(['new', 'confirmed', 'preparing', 'ready', 'served']), []);
  const [transferFrom, setTransferFrom] = useState<Table | null>(null);
  const [mergeFrom, setMergeFrom] = useState<Table | null>(null);
  const [bookTable, setBookTable] = useState<Table | null>(null);
  const [bookForm, setBookForm] = useState({ user_name: '', user_phone: '', date: '', time: '', guest_count: 2, comment: '' });

  const todayBookings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (bookings || []).filter((b: any) => b.date === today && b.status !== 'cancelled');
  }, [bookings]);

  const getTableBooking = (tableId: number) => todayBookings.find((b: any) => b.tableId === tableId);

  const getTableStatus = (table: Table) => {
    if (getTableBooking(table.id)) return 'reserved';
    if (table.status && table.status !== 'free') return table.status;
    const tableOrders = orders.filter(o => o.tableId === table.id && activeStatuses.has(o.status || ''));
    return tableOrders.length > 0 ? 'occupied' : 'free';
  };

  const getTableTotal = (tableId: number) => {
    return orders
      .filter(o => o.tableId === tableId && activeStatuses.has(o.status || ''))
      .reduce((sum, o) => sum + (o.total || 0), 0);
  };

  const getActiveOrder = (tableId: number) => {
    return orders.find(o => o.tableId === tableId && activeStatuses.has(o.status || '')) || null;
  };

  const statusColor: Record<string, string> = {
    free: darkMode ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-green-100 border-green-500 text-green-700',
    occupied: darkMode ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-red-100 border-red-500 text-red-700',
    reserved: darkMode ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-blue-100 border-blue-500 text-blue-700',
    bill_requested: darkMode ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-yellow-100 border-yellow-500 text-yellow-700',
    cleaning: darkMode ? 'bg-zinc-600/30 border-zinc-500 text-zinc-400' : 'bg-zinc-200 border-zinc-500 text-zinc-600',
  };

  const statusLabel: Record<string, string> = {
    free: 'Свободен', occupied: 'Занят', reserved: 'Бронь', bill_requested: 'Счёт', cleaning: 'Уборка',
  };

  const zones = useMemo(() => [...new Set(tables.map(t => t.zone).filter(Boolean))], [tables]);
  const activeTables = tables.filter(t => t.isActive !== 0);

  const cycleStatus = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    const current = getTableStatus(table);
    const idx = STATUSES.indexOf(current as any);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    onStatusChange(table.id, next);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <LayoutDashboard size={20} className="text-orange-500" /> План зала
        </h2>
        {zones.length > 0 && (
          <div className="text-xs opacity-60">{zones.join(', ')}</div>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {activeTables.map(table => {
          const status = getTableStatus(table);
          const total = getTableTotal(table.id);
          const isOccupied = status === 'occupied';
          return (
            <button
              key={table.id}
              onClick={() => onTableClick(table)}
              className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center active:scale-95 transition-transform ${statusColor[status]}`}
            >
              <span
                onClick={e => cycleStatus(table, e)}
                className="absolute top-1 right-1 p-1 rounded-md hover:bg-white/20"
                title="Сменить статус"
              >
                <MoreVertical size={12} />
              </span>
              {isOccupied && onTransfer && (
                <span
                  onClick={e => { e.stopPropagation(); setTransferFrom(table); }}
                  className="absolute top-1 left-1 p-1 rounded-md hover:bg-white/20"
                  title="Перенести чек"
                >
                  <ArrowRightLeft size={12} />
                </span>
              )}
              {isOccupied && onMerge && (
                <span
                  onClick={e => { e.stopPropagation(); setMergeFrom(table); }}
                  className="absolute bottom-1 left-1 p-1 rounded-md hover:bg-white/20"
                  title="Объединить стол"
                >
                  <Merge size={12} />
                </span>
              )}
              {onBook && (
                <span
                  onClick={e => { e.stopPropagation(); setBookTable(table); const now = new Date(); setBookForm({ ...bookForm, date: now.toISOString().slice(0, 10), time: `${String(now.getHours()).padStart(2, '0')}:00` }); }}
                  className="absolute bottom-1 right-1 p-1 rounded-md hover:bg-white/20"
                  title="Забронировать"
                >
                  <Calendar size={12} />
                </span>
              )}
              <span className="text-2xl font-extrabold">{table.name}</span>
              {isOccupied && (
                <span className="text-[10px] font-semibold mt-1">{total.toFixed(0)} ₽</span>
              )}
              {getTableBooking(table.id) && (
                <span className="text-[9px] font-semibold mt-0.5 opacity-90">{getTableBooking(table.id).time}</span>
              )}
              <span className="text-[9px] font-semibold mt-0.5 opacity-70">{statusLabel[status]}</span>
              {table.capacity ? <span className="text-[9px] opacity-60">{table.capacity} чел.</span> : null}
            </button>
          );
        })}
      </div>

      {transferFrom && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Перенести со стола {transferFrom.name}</h2>
              <button onClick={() => setTransferFrom(null)}><X size={20} /></button>
            </div>
            <p className="text-sm opacity-70 mb-3">Выберите свободный стол:</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {activeTables.filter(t => t.id !== transferFrom.id && getTableStatus(t) === 'free').map(t => (
                <button
                  key={t.id}
                  onClick={() => { onTransfer?.(transferFrom.id, t.id); setTransferFrom(null); }}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center font-bold text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 hover:border-orange-500' : 'bg-white border-zinc-300 hover:border-orange-400'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {activeTables.filter(t => t.id !== transferFrom.id && getTableStatus(t) === 'free').length === 0 && (
              <p className="text-sm opacity-60 text-center">Нет свободных столов</p>
            )}
            <button onClick={() => setTransferFrom(null)} className="w-full py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
          </div>
        </div>
      )}

      {bookTable && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setBookTable(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Бронь стола {bookTable.name}</h2>
              <button onClick={() => setBookTable(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input value={bookForm.user_name} onChange={e => setBookForm({ ...bookForm, user_name: e.target.value })} placeholder="Имя гостя" className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              <input value={bookForm.user_phone} onChange={e => setBookForm({ ...bookForm, user_phone: e.target.value })} placeholder="Телефон" className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                <input type="time" value={bookForm.time} onChange={e => setBookForm({ ...bookForm, time: e.target.value })} className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              </div>
              <input type="number" min={1} value={bookForm.guest_count} onChange={e => setBookForm({ ...bookForm, guest_count: Math.max(1, Number(e.target.value)) })} placeholder="Гостей" className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              <input value={bookForm.comment} onChange={e => setBookForm({ ...bookForm, comment: e.target.value })} placeholder="Комментарий" className={`w-full px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
            <button
              onClick={() => { onBook?.(bookTable.id, bookForm); setBookTable(null); }}
              disabled={!bookForm.user_name || !bookForm.user_phone || !bookForm.date || !bookForm.time}
              className="w-full mt-4 py-3 rounded-xl bg-orange-600 disabled:opacity-50 text-white font-bold text-sm"
            >
              Забронировать
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-6 text-[10px] text-zinc-500 font-medium">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Свободен</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Занят</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Счёт</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Бронь</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Уборка</span>
      </div>

      {activeTables.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <p>Столы не настроены. Добавьте столы в бэк-офисе.</p>
        </div>
      )}

      {mergeFrom && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setMergeFrom(null)}>
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Объединить со столом {mergeFrom.name}</h2>
              <button onClick={() => setMergeFrom(null)}><X size={20} /></button>
            </div>
            <p className="text-sm opacity-70 mb-3">Выберите другой занятый стол для объединения счетов:</p>
            <div className="grid grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
              {activeTables.filter(t => t.id !== mergeFrom.id && getTableStatus(t) === 'occupied').map(t => {
                const order = getActiveOrder(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      const fromOrder = getActiveOrder(mergeFrom.id);
                      if (fromOrder && order) onMerge?.(fromOrder.id, order.id);
                      setMergeFrom(null);
                    }}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-xs font-bold ${darkMode ? 'bg-zinc-800 border-zinc-700 hover:border-orange-500' : 'bg-white border-zinc-300 hover:border-orange-400'}`}
                  >
                    {t.name}
                    <span className="text-[9px] font-normal opacity-70">#{order?.id}</span>
                  </button>
                );
              })}
            </div>
            {activeTables.filter(t => t.id !== mergeFrom.id && getTableStatus(t) === 'occupied').length === 0 && (
              <p className="text-sm text-zinc-500 mt-3">Нет других занятых столов</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
