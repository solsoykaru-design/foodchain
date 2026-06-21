import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Play, Square, FileText, Download, RefreshCw, History, X, Printer } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function ShiftsPage() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [zReport, setZReport] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, list] = await Promise.all([
        api.getCurrentShift().catch(() => null),
        api.getShifts(page).catch(() => ({ items: [], totalPages: 1 })),
      ]);
      setCurrentShift(current);
      setShifts(list.items || []);
      setTotalPages(list.totalPages || 1);
    } catch {}
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    setBusy(true);
    try {
      const adminInfo = JSON.parse(localStorage.getItem('fc_user') || '{}');
      const result = await api.openShift(adminInfo.id || 1, adminInfo.username || adminInfo.name || 'Администратор', openingBalance);
      if (result.success) {
        setCurrentShift(result.shift);
        setOpeningBalance(0);
        addToast('Смена открыта', 'success');
        load();
      } else {
        addToast(result.error || 'Ошибка', 'error');
      }
    } catch (e: any) { addToast(e.message, 'error'); }
    setBusy(false);
  };

  const handleClose = async () => {
    if (!currentShift) return;
    setBusy(true);
    try {
      const result = await api.closeShift(currentShift.id, closingBalance, notes);
      if (result.success) {
        setCurrentShift(null);
        setClosingBalance(0);
        setNotes('');
        addToast(`Смена закрыта. Разница: ${result.difference}₽`, result.difference === 0 ? 'success' : 'warning');
        load();
      } else {
        addToast(result.error || 'Ошибка', 'error');
      }
    } catch (e: any) { addToast(e.message, 'error'); }
    setBusy(false);
  };

  const viewZReport = async (id: number) => {
    try {
      const result = await api.getShiftZReport(id);
      if (result.success) setZReport(result);
      else addToast(result.error, 'error');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const printZReport = () => {
    if (!zReport) return;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    const s = zReport.shift;
    const lines = [
      '========== Z-ОТЧЁТ ==========',
      `Смена #${s.id}`,
      `Открыл: ${s.staff_name}`,
      `Открыта: ${s.opened_at}`,
      `Закрыта: ${s.closed_at || '—'}`,
      '',
      '--- ОСТАТКИ ---',
      `Начальный: ${s.opening_balance} ₽`,
      `Ожидаемый: ${s.expected_balance} ₽`,
      `Фактический: ${s.closing_balance} ₽`,
      `Разница: ${(s.closing_balance - s.expected_balance).toFixed(2)} ₽`,
      '',
      '--- ВЫРУЧКА ---',
      `Заказов: ${s.order_count}`,
      `Наличные: ${s.cash_income} ₽`,
      `Карта: ${s.card_income} ₽`,
      `Онлайн: ${s.online_income} ₽`,
      `QR: ${s.qr_income} ₽`,
      `Прочее: ${s.other_income} ₽`,
      `Итого: ${s.total_income} ₽`,
      `Скидки: ${s.total_discount} ₽`,
      '',
      '--- ПО ПЛАТЕЖАМ ---',
      ...(zReport.payments || []).map((p: any) => `${p.method}: ${p.count} шт. — ${p.total} ₽`),
      '',
      '--- ПО КАССИРАМ ---',
      ...(zReport.byCashier || []).map((c: any) => `${c.cashier}: ${c.cnt} зак. — ${c.total} ₽`),
      '',
      `Отмен: ${zReport.cancellations.count} (${zReport.cancellations.total} ₽)`,
      `Возвратов: ${zReport.refunds.count} (${zReport.refunds.total} ₽)`,
      s.notes ? `Примечание: ${s.notes}` : '',
      '==============================',
    ];
    const pre = w.document.createElement('pre');
    pre.style.cssText = 'font:12px monospace;padding:16px';
    pre.textContent = lines.join('\n');
    w.document.body.appendChild(pre);
    setTimeout(() => w.print(), 300);
  };

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <DollarSign size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Смены и Z-отчёт</h1>
          <p className="text-sm text-zinc-500">Управление кассовыми сменами, открытие/закрытие, формирование Z-отчета</p>
        </div>
      </div>

      {/* Current shift status */}
      <div className={`rounded-2xl p-6 shadow-sm ${currentShift ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-white dark:bg-zinc-900'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${currentShift ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            {currentShift ? 'Смена открыта' : 'Смена закрыта'}
          </h2>
          <button onClick={load} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">
            <RefreshCw size={18} className="text-zinc-500" />
          </button>
        </div>

        {currentShift ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><p className="text-xs text-zinc-500">Открыл</p><p className="font-semibold">{currentShift.staff_name}</p></div>
            <div><p className="text-xs text-zinc-500">Открыта</p><p className="font-semibold">{new Date(currentShift.opened_at).toLocaleString('ru-RU')}</p></div>
            <div><p className="text-xs text-zinc-500">Начальный остаток</p><p className="font-semibold">{currentShift.opening_balance} ₽</p></div>
            <div><p className="text-xs text-zinc-500">Заказов в смене</p><p className="font-semibold">{currentShift.order_count || 0}</p></div>
          </div>
        ) : (
          <p className="text-zinc-400 text-sm mb-4">Нет открытой смены. Откройте смену для начала работы.</p>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          {currentShift ? (
            <div className="space-y-3 max-w-md">
              <div>
                <p className="text-sm font-medium mb-1">Фактический остаток в кассе (для закрытия)</p>
                <input type="number" value={closingBalance} onChange={e => setClosingBalance(Number(e.target.value))}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="0" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Примечание</p>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Опционально" />
              </div>
              <button onClick={handleClose} disabled={busy}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
                <Square size={16} /> {busy ? 'Закрытие...' : 'Закрыть смену'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <div>
                <p className="text-sm font-medium mb-1">Начальный остаток в кассе</p>
                <input type="number" value={openingBalance} onChange={e => setOpeningBalance(Number(e.target.value))}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="0" />
              </div>
              <button onClick={handleOpen} disabled={busy}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
                <Play size={16} /> {busy ? 'Открытие...' : 'Открыть смену'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Z-Report modal */}
      {zReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setZReport(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} className="text-blue-500" /> Z-отчёт #{zReport.shift.id}</h3>
              <button onClick={() => setZReport(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X size={18} className="text-zinc-500" /></button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-zinc-500">Открыл:</span><span className="font-medium ml-1">{zReport.shift.staff_name}</span></div>
                <div><span className="text-zinc-500">Заказов:</span><span className="font-medium ml-1">{zReport.shift.order_count}</span></div>
                <div><span className="text-zinc-500">Открыта:</span><span className="ml-1">{new Date(zReport.shift.opened_at).toLocaleString('ru-RU')}</span></div>
                <div><span className="text-zinc-500">Закрыта:</span><span className="ml-1">{zReport.shift.closed_at ? new Date(zReport.shift.closed_at).toLocaleString('ru-RU') : '—'}</span></div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                <p className="font-semibold mb-2">Баланс</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Начальный остаток</span><span>{zReport.shift.opening_balance} ₽</span></div>
                  <div className="flex justify-between"><span>Ожидаемый остаток</span><span className="font-medium">{zReport.shift.expected_balance} ₽</span></div>
                  <div className="flex justify-between"><span>Фактический остаток</span><span className="font-medium">{zReport.shift.closing_balance} ₽</span></div>
                  <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-1">
                    <span className="font-bold">Разница</span>
                    <span className={`font-bold ${(zReport.shift.closing_balance - zReport.shift.expected_balance) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(zReport.shift.closing_balance - zReport.shift.expected_balance).toFixed(2)} ₽
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                <p className="font-semibold mb-2">Выручка по типам оплаты</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Наличные</span><span>{zReport.shift.cash_income} ₽</span></div>
                  <div className="flex justify-between"><span>Карта</span><span>{zReport.shift.card_income} ₽</span></div>
                  <div className="flex justify-between"><span>Онлайн</span><span>{zReport.shift.online_income} ₽</span></div>
                  <div className="flex justify-between"><span>QR/SBP</span><span>{zReport.shift.qr_income} ₽</span></div>
                  <div className="flex justify-between"><span>Прочее</span><span>{zReport.shift.other_income} ₽</span></div>
                  <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-1 font-bold">
                    <span>Итого</span><span>{zReport.shift.total_income} ₽</span>
                  </div>
                  <div className="flex justify-between text-zinc-500"><span>Скидки</span><span>-{zReport.shift.total_discount} ₽</span></div>
                </div>
              </div>

              {zReport.payments?.length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                  <p className="font-semibold mb-2">По платёжным методам</p>
                  {zReport.payments.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between"><span>{p.method}</span><span>{p.count} шт. — {p.total} ₽</span></div>
                  ))}
                </div>
              )}

              {zReport.byCashier?.length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                  <p className="font-semibold mb-2">По кассирам</p>
                  {zReport.byCashier.map((c: any, i: number) => (
                    <div key={i} className="flex justify-between"><span>{c.cashier}</span><span>{c.cnt} зак. — {c.total} ₽</span></div>
                  ))}
                </div>
              )}

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex gap-2">
                <button onClick={() => printZReport()} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  <Printer size={16} /> Печать
                </button>
                <button onClick={() => { setZReport(null); }} className="flex items-center gap-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shifts history */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-zinc-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">История смен</h2>
        </div>

        {shifts.length === 0 ? (
          <div className="text-center py-8 text-zinc-400"><p className="text-sm">Смен ещё нет</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">№</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Открыл</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Открыта</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Закрыта</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Выручка</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Заказы</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Z-отчёт</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s: any) => (
                  <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-2.5 font-medium">{s.id}</td>
                    <td className="px-3 py-2.5">{s.staff_name}</td>
                    <td className="px-3 py-2.5 text-xs">{new Date(s.opened_at).toLocaleString('ru-RU')}</td>
                    <td className="px-3 py-2.5 text-xs">{s.closed_at ? new Date(s.closed_at).toLocaleString('ru-RU') : '—'}</td>
                    <td className="px-3 py-2.5 font-medium">{s.total_income} ₽</td>
                    <td className="px-3 py-2.5">{s.order_count}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'open' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                        {s.status === 'open' ? 'Открыта' : 'Закрыта'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => viewZReport(s.id)}
                        className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg transition">
                        <FileText size={14} /> Отчёт
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm disabled:opacity-40">←</button>
            <span className="px-3 py-1.5 text-sm text-zinc-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm disabled:opacity-40">→</button>
          </div>
        )}
      </div>
    </div>
  );
}
