import { useState } from 'react';
import { X, UserPlus, SplitSquareHorizontal, ArrowRightFromLine, Wallet, Clock } from 'lucide-react';
import * as api from '../../api';
import type { Table, DineInCheck } from '../../types';
import { usePrice } from '../../PriceContext';

export default function TableCard({
  table, checks, onClose, onAddOrder, onRefresh,
}: {
  table: Table; checks: DineInCheck[]; onClose: () => void;
  onAddOrder: () => void; onRefresh: () => void;
}) {
  const [guestCount, setGuestCount] = useState(table.capacity || 2);
  const [mergeMode, setMergeMode] = useState(false);
  const [targetTableId, setTargetTableId] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitItems, setSplitItems] = useState<number[]>([]);

  const handleMoveGuests = async () => {
    if (!targetTableId) return;
    try {
      await api.request('/api/waiter/move-guests', {
        method: 'POST',
        body: JSON.stringify({ fromTableId: table.id, toTableId: targetTableId }),
      });
      onRefresh();
      onClose();
    } catch (e: any) { alert(e.message); }
  };

  const handleSplit = async () => {
    if (!splitItems.length) return;
    try {
      for (const checkId of checks.filter(c => c.status === 'open').map(c => c.id)) {
        await api.request(`/api/waiter/split-check/${checkId}`, {
          method: 'POST',
          body: JSON.stringify({ orderItemIds: splitItems }),
        });
      }
      onRefresh();
      setSplitMode(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleRequestBill = async () => {
    try {
      await api.request(`/api/waiter/table/${table.id}/request-bill`, { method: 'POST' });
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdateGuests = async () => {
    try {
      await api.request(`/api/waiter/table/${table.id}/guests`, {
        method: 'PATCH',
        body: JSON.stringify({ guestCount }),
      });
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const statusLabel: Record<string, string> = {
    free: 'Свободен', occupied: 'Занят', reserved: 'Забронирован',
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-zinc-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-extrabold
              ${table.status === 'free' ? 'bg-green-500/20 text-green-400' : ''}
              ${table.status === 'occupied' ? 'bg-red-500/20 text-red-400' : ''}
              ${table.status === 'reserved' ? 'bg-blue-500/20 text-blue-400' : ''}
            `}>{table.name.replace(/[^0-9]/g, '')}</div>
            <div>
              <h3 className="text-lg font-extrabold text-white">{table.name}</h3>
              <p className="text-xs text-zinc-500">{statusLabel[table.status]} · {table.zone || 'Основной зал'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Guest count */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-zinc-400 mb-2">Количество гостей</p>
          <div className="flex items-center gap-3">
            <button onClick={() => { setGuestCount(Math.max(1, guestCount - 1)); handleUpdateGuests(); }}
              className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><UserPlus size={16} /></button>
            <span className="text-xl font-extrabold text-white">{guestCount}</span>
            <button onClick={() => { setGuestCount(guestCount + 1); handleUpdateGuests(); }}
              className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><UserPlus size={16} /></button>
          </div>
        </div>

        {/* Open orders */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-zinc-400 mb-3">Заказы ({checks.filter(c => c.status === 'open').length})</p>
          {checks.filter(c => c.status === 'open').length === 0 ? (
            <p className="text-sm text-zinc-600">Нет открытых заказов</p>
          ) : (
            <div className="space-y-2">
              {checks.filter(c => c.status === 'open').map(check => (
                <div key={check.id} className="bg-zinc-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-400">Чек #{check.id}</span>
                    <span className="text-sm font-extrabold text-orange-500">{usePrice()(check.total)}</span>
                  </div>
                  {check.orders?.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-0.5 text-sm">
                      <span className="text-zinc-300">{order.items?.length} блюд</span>
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Split items (if split mode) */}
        {splitMode && (
          <div className="px-5 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-zinc-400 mb-2">Выберите блюда для разделения</p>
            {checks.filter(c => c.status === 'open').flatMap(c => c.orders || []).flatMap(o => o.items || []).map((item: any, i: number) => (
              <label key={i} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={splitItems.includes(item.dishId)} onChange={() => {
                  setSplitItems(prev => prev.includes(item.dishId) ? prev.filter(id => id !== item.dishId) : [...prev, item.dishId]);
                }} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-zinc-300">{item.name} × {item.quantity}</span>
              </label>
            ))}
            <div className="flex gap-2 mt-3">
              <button onClick={handleSplit} className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm">Разделить</button>
              <button onClick={() => setSplitMode(false)} className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-2 rounded-xl text-sm">Отмена</button>
            </div>
          </div>
        )}

        {/* Merge mode */}
        {mergeMode && (
          <div className="px-5 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-zinc-400 mb-2">ID стола для объединения</p>
            <input value={targetTableId || ''} onChange={e => setTargetTableId(Number(e.target.value))}
              className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-2" placeholder="Введите номер стола" />
            <div className="flex gap-2">
              <button onClick={handleMoveGuests} className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm">Объединить</button>
              <button onClick={() => setMergeMode(false)} className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-2 rounded-xl text-sm">Отмена</button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 space-y-2">
          {table.status !== 'reserved' && (
            <button onClick={onAddOrder}
              className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2">
              <UserPlus size={18} /> Добавить заказ
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMergeMode(true)}
              className="bg-zinc-800 text-zinc-300 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5">
              <ArrowRightFromLine size={16} /> Переместить
            </button>
            <button onClick={() => setSplitMode(true)}
              className="bg-zinc-800 text-zinc-300 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5">
              <SplitSquareHorizontal size={16} /> Разделить счёт
            </button>
            <button onClick={handleRequestBill}
              className="bg-zinc-800 text-zinc-300 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5">
              <Wallet size={16} /> Попросить счёт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
