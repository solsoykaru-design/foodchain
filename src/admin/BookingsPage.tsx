import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { CalendarDays, Plus, X, Edit3, Trash2, Move, Square, Check, RotateCcw, Users, Clock, QrCode } from 'lucide-react';

export default function BookingsPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showTableForm, setShowTableForm] = useState(false);
  const [editTable, setEditTable] = useState<any>(null);
  const [tableForm, setTableForm] = useState({ name: '', capacity: 2, zone: 'Зал', x: 20, y: 20, width: 60, height: 60, color: '#3b82f6' });
  const [dragging, setDragging] = useState<number | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const [resizing, setResizing] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({ userName: '', userPhone: '', time: '18:00', guestCount: 2, comment: '' });

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([api.getTables(), api.getBookings()]);
      setTables(t);
      setBookings(b);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const dayBookings = bookings.filter((b: any) => b.date === selectedDate);

  const saveTable = async () => {
    try {
      if (editTable) {
        await api.updateTable(editTable.id, tableForm);
      } else {
        await api.createTable(tableForm);
      }
      setShowTableForm(false);
      setEditTable(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteTable = async (id: number) => {
    if (!confirm('Удалить стол?')) return;
    try { await api.deleteTable(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openEditTable = (t: any) => {
    setEditTable(t);
    setTableForm({ name: t.name, capacity: t.capacity, zone: t.zone || 'Зал', x: t.x || 20, y: t.y || 20, width: t.width || 60, height: t.height || 60, color: t.color || '#3b82f6' });
    setShowTableForm(true);
  };

  const handleMouseDown = (e: React.MouseEvent, tableId: number) => {
    e.preventDefault();
    setDragging(tableId);
    const t = tables.find(t => t.id === tableId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: t?.x || 0, origY: t?.y || 0 };
  };

  const handleResizeDown = (e: React.MouseEvent, tableId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(tableId);
    const t = tables.find(t => t.id === tableId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: t?.width || 60, origY: t?.height || 60 };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging !== null) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setTables(prev => prev.map(t => t.id === dragging ? { ...t, x: Math.max(0, dragRef.current.origX + dx), y: Math.max(0, dragRef.current.origY + dy) } : t));
      }
      if (resizing !== null) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setTables(prev => prev.map(t => t.id === resizing ? { ...t, width: Math.max(30, dragRef.current.origX + dx), height: Math.max(30, dragRef.current.origY + dy) } : t));
      }
    };
    const onMouseUp = async () => {
      if (dragging !== null) {
        const t = tables.find(t => t.id === dragging);
        if (t) try { await api.updateTable(dragging, { x: t.x, y: t.y }); } catch {}
        setDragging(null);
      }
      if (resizing !== null) {
        const t = tables.find(t => t.id === resizing);
        if (t) try { await api.updateTable(resizing, { width: t.width, height: t.height }); } catch {}
        setResizing(null);
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragging, resizing, tables]);

  const confirmBooking = async (id: number) => {
    try { await api.updateBookingStatus(id, 'confirmed'); load(); } catch {}
  };
  const cancelBooking = async (id: number) => {
    try { await api.updateBookingStatus(id, 'cancelled'); load(); } catch {}
  };
  const completeBooking = async (id: number) => {
    try { await api.updateBookingStatus(id, 'completed'); load(); } catch {}
  };

  const createBooking = async (tableId: number) => {
    if (!bookingForm.userName || !bookingForm.userPhone) return addToast('Заполните имя и телефон', 'error');
    try {
      await api.createBooking({
        table_id: tableId, date: selectedDate, time: bookingForm.time,
        guest_count: bookingForm.guestCount, user_name: bookingForm.userName,
        user_phone: bookingForm.userPhone, comment: bookingForm.comment,
      });
      setShowBookingForm(false);
      setSelectedTable(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const tableBookings = (tableId: number) => dayBookings.filter((b: any) => b.tableId === tableId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Бронирования</h2>
          <p className="text-sm text-zinc-500 mt-1">Управление столами и бронями</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
          <button onClick={() => { setEditTable(null); setTableForm({ name: 'Новый стол', capacity: 2, zone: 'Зал', x: 20, y: 20, width: 60, height: 60, color: '#3b82f6' }); setShowTableForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97] transition-all"><Plus size={18} /> Добавить стол</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Схема зала</h3>
          <div className="relative bg-zinc-100 dark:bg-zinc-800 rounded-xl min-h-[500px]" style={{ backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {tables.filter((t: any) => t.isActive !== false).map((t: any) => {
              const bks = tableBookings(t.id);
              const statusColor = bks.some((b: any) => b.status === 'confirmed') ? '#ef4444' : bks.some((b: any) => b.status === 'pending') ? '#f59e0b' : t.color || '#3b82f6';
              return (
                <div key={t.id} className="absolute cursor-move" style={{ left: (t.x || 20), top: (t.y || 20), width: (t.width || 60), height: (t.height || 60) }}
                  onMouseDown={e => handleMouseDown(e, t.id)} onClick={() => { setSelectedTable(selectedTable === t.id ? null : t.id); setShowBookingForm(false); }}>
                  <div className="w-full h-full rounded-xl border-2 flex flex-col items-center justify-center text-xs font-bold text-white transition-shadow hover:shadow-lg" style={{ backgroundColor: statusColor, borderColor: selectedTable === t.id ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                    <span>{t.name}</span>
                    <span className="opacity-80">{t.capacity} чел</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-white/30 rounded-sm cursor-se-resize" onMouseDown={e => handleResizeDown(e, t.id)} />
                  {selectedTable === t.id && (
                    <div className="absolute top-0 -right-32 flex gap-1 z-10 flex-wrap">
                      <button onClick={() => openEditTable(t)} className="p-1 bg-zinc-800 text-white rounded text-[10px] hover:bg-zinc-700"><Edit3 size={12} /></button>
                      <button onClick={() => deleteTable(t.id)} className="p-1 bg-red-600 text-white rounded text-[10px] hover:bg-red-500"><Trash2 size={12} /></button>
                      <button onClick={() => {
                        const url = `${window.location.origin}/guest?page=qr-menu&table_id=${t.id}`;
                        window.open(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`, '_blank');
                      }} className="p-1 bg-green-600 text-white rounded text-[10px] hover:bg-green-500"><QrCode size={12} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Брони на {new Date(selectedDate).toLocaleDateString('ru-RU')}</h3>
            {dayBookings.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">Нет броней на этот день</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {dayBookings.map((b: any) => {
                  const table = tables.find(t => t.id === b.tableId);
                  return (
                    <div key={b.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{b.userName}</p>
                          <p className="text-xs text-zinc-500">{b.userPhone}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{table?.name || 'Стол'} • {b.time} • {b.guestCount} чел</p>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : b.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : b.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {b.status === 'confirmed' ? 'Подтверждено' : b.status === 'cancelled' ? 'Отменено' : b.status === 'completed' ? 'Завершено' : 'Ожидание'}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {b.status === 'pending' && <><button onClick={() => confirmBooking(b.id)} className="flex-1 text-[10px] bg-green-500 text-white py-1 rounded-lg font-medium hover:bg-green-600"><Check size={12} className="inline" /> Подтвердить</button><button onClick={() => cancelBooking(b.id)} className="flex-1 text-[10px] bg-red-500 text-white py-1 rounded-lg font-medium hover:bg-red-600"><X size={12} className="inline" /> Отменить</button></>}
                        {b.status === 'confirmed' && <><button onClick={() => completeBooking(b.id)} className="flex-1 text-[10px] bg-blue-500 text-white py-1 rounded-lg font-medium hover:bg-blue-600">Завершить</button><button onClick={() => cancelBooking(b.id)} className="flex-1 text-[10px] bg-red-500 text-white py-1 rounded-lg font-medium hover:bg-red-600">Отменить</button></>}
                      </div>
                      {b.comment && <p className="text-xs text-zinc-400 mt-1 italic">📝 {b.comment}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showBookingForm && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Новая бронь</h3>
              <div className="space-y-3">
                <input value={bookingForm.userName} onChange={e => setBookingForm({...bookingForm, userName: e.target.value})} placeholder="Имя" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                <input value={bookingForm.userPhone} onChange={e => setBookingForm({...bookingForm, userPhone: e.target.value})} placeholder="Телефон" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={bookingForm.time} onChange={e => setBookingForm({...bookingForm, time: e.target.value})} className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  <input type="number" value={bookingForm.guestCount || ''} onChange={e => setBookingForm({...bookingForm, guestCount: e.target.value === '' ? 2 : Number(e.target.value)})} min={1} placeholder="Гостей" className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
                <input value={bookingForm.comment} onChange={e => setBookingForm({...bookingForm, comment: e.target.value})} placeholder="Комментарий" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                <button onClick={() => selectedTable && createBooking(selectedTable)} className="w-full bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-green-600">Создать бронь</button>
              </div>
            </div>
          )}

          {selectedTable && !showBookingForm && (
            <button onClick={() => setShowBookingForm(true)} className="w-full bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-indigo-600 active:scale-[0.97] transition-all">
              <Plus size={18} className="inline mr-1" /> Бронь на {tables.find(t => t.id === selectedTable)?.name}
            </button>
          )}
        </div>
      </div>

      {showTableForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTableForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">{editTable ? 'Редактировать' : 'Добавить'} стол</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Название</label>
                  <input value={tableForm.name} onChange={e => setTableForm({...tableForm, name: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Вместимость</label>
                  <input type="number" value={tableForm.capacity || ''} onChange={e => setTableForm({...tableForm, capacity: e.target.value === '' ? 2 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Зона</label>
                <select value={tableForm.zone} onChange={e => setTableForm({...tableForm, zone: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1">
                  <option>Зал</option><option>Терраса</option><option>VIP</option><option>Бар</option>
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-xs font-medium text-zinc-500">X</label><input type="number" value={tableForm.x ?? ''} onChange={e => setTableForm({...tableForm, x: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Y</label><input type="number" value={tableForm.y ?? ''} onChange={e => setTableForm({...tableForm, y: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">W</label><input type="number" value={tableForm.width ?? ''} onChange={e => setTableForm({...tableForm, width: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">H</label><input type="number" value={tableForm.height ?? ''} onChange={e => setTableForm({...tableForm, height: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Цвет</label>
                <input type="color" value={tableForm.color} onChange={e => setTableForm({...tableForm, color: e.target.value})} className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-1" />
              </div>
              <button onClick={saveTable} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
