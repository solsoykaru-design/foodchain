import { useState, useEffect } from 'react';
import { Wallet, CreditCard, QrCode, Gift, Printer, Check, X, SplitSquareHorizontal, Loader, Users, Plus, Minus, Trash2 } from 'lucide-react';
import * as api from '../../api';
import type { DineInCheck, Order } from '../../types';
import { usePrice } from '../../PriceContext';

interface Props {
  checks: DineInCheck[];
  onRefresh: () => void;
  onClose: () => void;
}

export default function PaymentScreen({ checks, onRefresh, onClose }: Props) {
  const readyPay = checks.filter(c => c.status === 'open').filter(
    c => c.orders?.some(o => o.status === 'ready' || o.status === 'served')
  );

  const [selectedCheck, setSelectedCheck] = useState<DineInCheck | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr' | 'bonus' | 'certificate' | 'terminal'>('cash');
  const [cashGiven, setCashGiven] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [splitAmount, setSplitAmount] = useState(0);
  const [splitMethods, setSplitMethods] = useState<{ method: string; amount: number }[]>([]);
  const [receiptGenerated, setReceiptGenerated] = useState(false);
  const [terminalPaying, setTerminalPaying] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<string>('');

  useEffect(() => {
    if (selectedCheck && paymentMethod === 'qr') {
      generateQr();
    }
  }, [selectedCheck, paymentMethod]);

  const generateQr = async () => {
    if (!selectedCheck) return;
    try {
      const result = await api.createQrPayment({
        amount: selectedCheck.total,
        description: `Заказ #${selectedCheck.id}`,
        qrType: 'sbp',
        returnUrl: window.location.href,
      });
      setQrCodeUrl(result.qrCode || result.url || '');
      setShowQr(true);
    } catch {
      setQrCodeUrl('https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=payment-pending');
      setShowQr(true);
    }
  };

  const handlePayment = async () => {
    if (!selectedCheck) return;
    if (paymentMethod === 'terminal') {
      setTerminalPaying(true);
      setTerminalStatus('Отправка на терминал...');
      try {
        for (const order of (selectedCheck.orders || []).filter(o => o.status === 'served' || o.status === 'ready')) {
          const result = await api.terminalPay(order.id, selectedCheck.total);
          if (result.success) {
            setTerminalStatus('Оплата прошла успешно ✓');
          } else {
            setTerminalStatus(result.error || 'Ошибка оплаты через терминал');
            if (result.retrying) setTerminalStatus('Терминал недоступен. Платёж поставлен в очередь и будет выполнен автоматически при восстановлении связи.');
          }
        }
        setTimeout(() => { setReceiptGenerated(true); onRefresh(); }, 1500);
      } catch (e: any) {
        setTerminalStatus('Ошибка соединения: ' + e.message);
      }
      setTerminalPaying(false);
      return;
    }
    try {
      for (const order of (selectedCheck.orders || []).filter(o => o.status === 'served' || o.status === 'ready')) {
        await api.processPayment(order.id, {
          paymentMethod,
          amount: paymentMethod === 'cash' ? cashGiven : undefined,
          cashGiven: paymentMethod === 'cash' ? cashGiven : undefined,
          isPaid: true,
        });
      }
      setReceiptGenerated(true);
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const handlePrintReceipt = async () => {
    try {
      window.print();
    } catch { alert('Печать недоступна'); }
  };

  const change = cashGiven - (selectedCheck?.total || 0);

  if (!selectedCheck) {
    return (
      <div className="pb-28 px-4 pt-4">
        <h2 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
          <Wallet size={20} className="text-orange-500" /> Оплата
        </h2>
        {readyPay.length === 0 ? (
          <div className="text-center py-16">
            <Wallet size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">Нет заказов для оплаты</p>
          </div>
        ) : (
          <div className="space-y-3">
            {readyPay.map(check => (
              <div key={check.id} onClick={() => setSelectedCheck(check)}
                className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 cursor-pointer active:scale-[0.99] transition-transform">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-bold text-white">{check.tableName}</span>
                    <p className="text-xs text-zinc-500">{check.guestCount} гостя</p>
                  </div>
                  <span className="text-xl font-extrabold text-orange-500">{usePrice()(check.total)}</span>
                </div>
                <button className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <CreditCard size={18} /> Принять оплату
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (receiptGenerated) {
    return (
      <div className="pb-28 px-4 pt-4">
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-green-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Оплата принята</h2>
          <p className="text-zinc-400 mb-8">{selectedCheck.tableName} · {usePrice()(selectedCheck.total)}</p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <button onClick={handlePrintReceipt}
              className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <Printer size={18} /> Печать чека
            </button>
            <button onClick={onClose}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderReceiptPreview = () => (
    <div className="bg-white text-black rounded-xl p-4 mb-4 text-xs font-mono">
      <div className="text-center font-bold text-sm mb-2">ООО «Ресторан»</div>
      <div className="text-center mb-3">КАССОВЫЙ ЧЕК</div>
      <div className="border-t border-dashed border-black mb-2" />
      {selectedCheck.orders?.flatMap(o => o.items || []).map((item, i) => (
        <div key={i} className="flex justify-between mb-1">
          <span>{item.name} × {item.quantity}</span>
          <span>{usePrice()(item.price * item.quantity)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between font-bold">
        <span>ИТОГО</span><span>{usePrice()(selectedCheck.total)}</span>
      </div>
      <div className="text-center mt-3">Время: {new Date().toLocaleString('ru')}</div>
      <div className="text-center">Заказ: #{selectedCheck.id}</div>
      <div className="text-center">Способ оплаты: {paymentMethod === 'cash' ? 'Наличные' : paymentMethod === 'card' ? 'Карта' : paymentMethod === 'qr' ? 'QR-код' : paymentMethod === 'terminal' ? 'Терминал' : 'Бонусы'}</div>
    </div>
  );

  return (
    <div className="pb-28 px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Wallet size={20} className="text-orange-500" /> Оплата
        </h2>
        <button onClick={() => setSelectedCheck(null)} className="p-1.5 bg-zinc-800 rounded-xl text-zinc-500"><X size={18} /></button>
      </div>

      <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-400">{selectedCheck.tableName}</span>
          <span className="text-zinc-500 text-xs">{selectedCheck.guestCount} гостя</span>
        </div>
        <div className="text-4xl font-extrabold text-orange-500 mb-4">{usePrice()(selectedCheck.total)}</div>

        {/* Receipt preview */}
        {renderReceiptPreview()}

        {/* Payment methods */}
        <p className="text-sm font-semibold text-zinc-400 mb-3">Способ оплаты</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { key: 'cash' as const, label: 'Наличные', icon: Wallet },
            { key: 'card' as const, label: 'Карта', icon: CreditCard },
            { key: 'qr' as const, label: 'QR-код', icon: QrCode },
            { key: 'bonus' as const, label: 'Бонусы', icon: Gift },
            { key: 'terminal' as const, label: 'Терминал', icon: CreditCard },
          ].map(m => (
            <button key={m.key} onClick={() => setPaymentMethod(m.key)}
              className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all ${paymentMethod === m.key ? 'bg-orange-500/10 ring-1 ring-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <m.icon size={18} /> {m.label}
            </button>
          ))}
        </div>

        {/* Cash input */}
        {paymentMethod === 'cash' && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-zinc-400 mb-2">Сумма от гостя</p>
            <input type="number" value={cashGiven || ''} onChange={e => setCashGiven(Number(e.target.value))}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-lg font-extrabold text-white outline-none" placeholder="0" />
            {cashGiven >= selectedCheck.total && (
              <p className="text-green-400 text-sm font-bold mt-1">Сдача: {usePrice()(change)}</p>
            )}
          </div>
        )}

        {/* QR code */}
        {paymentMethod === 'qr' && showQr && qrCodeUrl && (
          <div className="mb-4 flex flex-col items-center">
            <img src={qrCodeUrl} className="w-48 h-48 bg-white rounded-xl p-2" alt="QR-код" />
            <p className="text-xs text-zinc-500 mt-2">Отсканируйте для оплаты</p>
          </div>
        )}

        {/* Split bill */}
        <SplitBillModal
          check={selectedCheck}
          onClose={() => {}}
          onSplit={async (guests) => {
            const splits = guests.map(g => ({
              guest_name: g.name,
              items: g.items.map(i => i.dishId),
              amount: g.total,
            }));
            for (const order of (selectedCheck.orders || []).filter(o => o.status === 'served' || o.status === 'ready')) {
              await api.splitOrder(order.id, splits);
            }
            setReceiptGenerated(true);
            onRefresh();
          }}
        />

        {/* Terminal status */}
        {paymentMethod === 'terminal' && terminalStatus && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-semibold text-center ${terminalStatus.includes('успешно') ? 'bg-emerald-500/20 text-emerald-400' : terminalStatus.includes('недоступен') ? 'bg-amber-500/20 text-amber-400' : terminalStatus.includes('Ошибка') ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {terminalPaying && <Loader size={16} className="inline animate-spin mr-2" />}
            {terminalStatus}
          </div>
        )}

        {/* Pay button */}
        <button onClick={handlePayment}
          disabled={(paymentMethod === 'cash' && cashGiven < selectedCheck.total) || (paymentMethod === 'terminal' && terminalPaying)}
          className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {paymentMethod === 'terminal' ? (terminalPaying ? 'Оплата...' : 'Оплатить через терминал') : `Оплатить ${usePrice()(selectedCheck.total)}`}
        </button>
      </div>
    </div>
  );
}

interface SplitGuest {
  id: number;
  name: string;
  items: { dishId: number; name: string; price: number; quantity: number }[];
  total: number;
}

function SplitBillModal({ check, onClose, onSplit }: { check: DineInCheck; onClose: () => void; onSplit: (guests: SplitGuest[]) => Promise<void> }) {
  const [show, setShow] = useState(false);
  const [guests, setGuests] = useState<SplitGuest[]>([{ id: 1, name: 'Гость 1', items: [], total: 0 }]);
  const allItems = (check.orders || []).flatMap(o => (o.items || []).map(i => ({ dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity })));

  const unassigned = allItems.filter(item => !guests.some(g => g.items.some(gi => gi.dishId === item.dishId)));

  const addGuest = () => {
    setGuests(prev => [...prev, { id: Date.now(), name: `Гость ${prev.length + 1}`, items: [], total: 0 }]);
  };

  const removeGuest = (id: number) => {
    if (guests.length <= 1) return;
    setGuests(prev => prev.filter(g => g.id !== id));
  };

  const assignItem = (guestId: number, item: { dishId: number; name: string; price: number; quantity: number }) => {
    setGuests(prev => prev.map(g => {
      if (g.id !== guestId) return g;
      const exists = g.items.find(i => i.dishId === item.dishId);
      if (exists) {
        return { ...g, items: g.items.map(i => i.dishId === item.dishId ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...g, items: [...g.items, { ...item, quantity: 1 }] };
    }));
  };

  const removeAssignedItem = (guestId: number, dishId: number) => {
    setGuests(prev => prev.map(g => {
      if (g.id !== guestId) return g;
      const exists = g.items.find(i => i.dishId === dishId);
      if (exists && exists.quantity > 1) {
        return { ...g, items: g.items.map(i => i.dishId === dishId ? { ...i, quantity: i.quantity - 1 } : i) };
      }
      return { ...g, items: g.items.filter(i => i.dishId !== dishId) };
    }));
  };

  const guestTotals = guests.map(g => ({
    ...g,
    total: g.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  }));

  const grandTotal = guestTotals.reduce((sum, g) => sum + g.total, 0);

  return (
    <>
      <div className="mb-4">
        <button onClick={() => setShow(true)} className="flex items-center gap-1.5 text-sm text-zinc-400 font-semibold hover:text-white transition-colors">
          <Users size={16} /> Разделить счёт
        </button>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setShow(false)}>
          <div className="bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">Разделить счёт</h3>
              <button onClick={() => setShow(false)} className="p-1.5 bg-zinc-800 rounded-xl text-zinc-500"><X size={18} /></button>
            </div>

            {/* Unassigned items */}
            {unassigned.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-zinc-400 mb-2">Блюда для распределения</p>
                <div className="space-y-1">
                  {unassigned.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-zinc-800 rounded-xl px-3 py-2">
                      <span className="text-sm text-white">{item.name} × {item.quantity}</span>
                      <div className="flex gap-1">
                        {guestTotals.map(g => (
                          <button key={g.id} onClick={() => assignItem(g.id, item)} className="text-[10px] bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg hover:bg-zinc-600">
                            {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guests */}
            <div className="space-y-3 mb-4">
              {guestTotals.map(g => (
                <div key={g.id} className="bg-zinc-800/50 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <input value={g.name} onChange={e => setGuests(prev => prev.map(gg => gg.id === g.id ? { ...gg, name: e.target.value } : gg))} className="bg-transparent text-sm font-semibold text-white outline-none border-b border-zinc-600 pb-0.5" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-orange-500">{usePrice()(g.total)}</span>
                      <button onClick={() => removeGuest(g.id)} className="p-1 text-zinc-500 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {g.items.length === 0 ? (
                    <p className="text-xs text-zinc-600">Нет блюд</p>
                  ) : (
                    <div className="space-y-1">
                      {g.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{item.name} × {item.quantity}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">{usePrice()(item.price * item.quantity)}</span>
                            <button onClick={() => removeAssignedItem(g.id, item.dishId)} className="text-zinc-600 hover:text-red-500"><X size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addGuest} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-400 font-semibold py-2.5 rounded-xl text-sm mb-4 hover:bg-zinc-700">
              <Plus size={16} /> Добавить гостя
            </button>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-3 mb-4">
              <span className="text-sm text-zinc-400">Итого</span>
              <span className="text-lg font-extrabold text-white">{usePrice()(grandTotal)}</span>
            </div>

            <button onClick={async () => { await onSplit(guestTotals); setShow(false); }} disabled={guestTotals.some(g => g.items.length === 0)} className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-40">
              Подтвердить разделение
            </button>
          </div>
        </div>
      )}
    </>
  );
}
