import { useState, useEffect, useRef } from 'react';
import { ClipboardList, Check, Clock, ChefHat, Truck, MessageSquare, X, Navigation, MapPin, Maximize2, CreditCard, Loader, Camera } from 'lucide-react';
import * as api from '../../api';
import type { DineInCheck, Order } from '../../types';
import { useOrderTimer } from '../hooks/useOrderTimer';
import StaffChatPopup from './StaffChatPopup';
import BarcodeScanner from '../../admin/BarcodeScanner';
import { usePrice } from '../../PriceContext';

interface Props {
  checks: DineInCheck[];
  onRefresh: () => void;
  onPayOrder: (order: Order) => void;
  user?: any;
}

function ItemTimer({ createdAt }: { createdAt?: string }) {
  const timer = useOrderTimer(createdAt, 20);
  const [elapsed, setElapsed] = useState(timer.getElapsed());
  const [warning, setWarning] = useState(timer.getIsWarning());
  useEffect(() => {
    const id = setInterval(() => { setElapsed(timer.getElapsed()); setWarning(timer.getIsWarning()); }, 1000);
    return () => clearInterval(id);
  }, [timer]);
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${warning ? 'text-red-400' : 'text-zinc-500'}`}>
      <Clock size={10} /> {elapsed}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400', confirmed: 'bg-blue-500/20 text-blue-400',
    preparing: 'bg-amber-500/20 text-amber-400', ready: 'bg-green-500/20 text-green-400',
    served: 'bg-purple-500/20 text-purple-400', paid: 'bg-emerald-500/20 text-emerald-400',
    assigned: 'bg-cyan-500/20 text-cyan-400', en_route: 'bg-indigo-500/20 text-indigo-400',
    delivered: 'bg-emerald-500/20 text-emerald-400', cancelled: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = {
    new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов',
    served: 'Подан', paid: 'Оплачен', assigned: 'Курьер назначен', en_route: 'В пути',
    delivered: 'Доставлен', cancelled: 'Отменён',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[status] || 'bg-zinc-700 text-zinc-400'}`}>
      {labels[status] || status}
    </span>
  );
}

function TerminalPayButton({ order, onRefresh }: { order: Order; onRefresh: () => void }) {
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleTerminalPay = async () => {
    setPaying(true);
    setStatus('pending');
    setErrorMsg('');
    try {
      const apiBase = localStorage.getItem('foodchain_api_url') || '';
      const token = localStorage.getItem('fc_token') || localStorage.getItem('foodchain_waiter_token') || '';
      const res = await fetch(`${apiBase}/api/terminal/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ orderId: order.id, amount: order.total }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setTimeout(() => { onRefresh(); }, 2000);
      } else if (data.retrying) {
        setStatus('error');
        setErrorMsg('Терминал недоступен. Платёж в очереди — будет выполнен автоматически при восстановлении связи.');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Ошибка оплаты');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Ошибка соединения');
    }
    setPaying(false);
  };

  if (status === 'success') {
    return (
      <div className="flex-1 bg-emerald-500/20 text-emerald-400 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1">
        <Check size={14} /> Оплачено
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <button onClick={handleTerminalPay} disabled={paying}
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-orange-500 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition disabled:opacity-60">
        {paying ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}
        {paying ? 'Оплата...' : 'Картой (терминал)'}
      </button>
      {status === 'error' && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-[10px] text-red-400 z-10">
          {errorMsg}
          <button onClick={() => setStatus('idle')} className="block text-center text-red-300 underline mt-1 w-full">Закрыть</button>
        </div>
      )}
    </div>
  );
}

export default function ActiveOrders({ checks, onRefresh, onPayOrder, user }: Props) {
  const [loadingOrderId, setLoadingOrderId] = useState<number | null>(null);
  const [staffChatOrder, setStaffChatOrder] = useState<Order | null>(null);
  const [returningData, setReturningData] = useState<Record<number, { courierName: string; distanceKm: number; durationMin: number; eta: string; polyline?: string }>>({});
  const [returnMapOrder, setReturnMapOrder] = useState<number | null>(null);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeSearchResult, setBarcodeSearchResult] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setShowBarcodeScanner(false);
    try {
      const result = await api.lookupByBarcode(barcode);
      if (result && result.id) {
        for (const check of checks) {
          for (const order of check.orders || []) {
            for (const item of order.items || []) {
              if (item.dishId === result.id || item.name === result.name) {
                alert(`Найден товар "${item.name}" в заказе #${order.id} (${check.tableName})`);
                return;
              }
            }
          }
        }
      }
      const dishResult = await api.lookupDishByBarcode(barcode);
      const found = Array.isArray(dishResult) ? dishResult[0] : dishResult;
      if (found) {
        for (const check of checks) {
          for (const order of check.orders || []) {
            for (const item of order.items || []) {
              if (item.dishId === found.id) {
                alert(`Найдено блюдо "${item.name}" в заказе #${order.id} (${check.tableName})`);
                return;
              }
            }
          }
        }
      }
      alert('Ничего не найдено по этому штрихкоду в активных заказах');
    } catch { alert('Ошибка поиска по штрихкоду'); }
  };
  const waiterMapRef = useRef<HTMLDivElement>(null);
  const waiterMapInstance = useRef<any>(null);

  // Load Yandex Maps JS API
  useEffect(() => {
    if (typeof ymaps !== 'undefined') { setYmapsLoaded(true); return; }
    const apiBase = localStorage.getItem('foodchain_api_url') || '';
    fetch(apiBase + '/api/settings').then(r => r.json()).then(settings => {
      const key = settings.yandex_maps_api_key || '';
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
      script.onload = () => setYmapsLoaded(true);
      document.head.appendChild(script);
    }).catch(() => {});
  }, []);

  // Init map modal
  useEffect(() => {
    if (!ymapsLoaded || returnMapOrder === null || !waiterMapRef.current) return;
    if (waiterMapInstance.current) { waiterMapInstance.current.destroy(); waiterMapInstance.current = null; }
    const rd = returningData[returnMapOrder];
    if (!rd) return;
    ymaps.ready(() => {
      const el = waiterMapRef.current; if (!el) return;
      const map = new ymaps.Map(el, { center: [55.75, 37.62], zoom: 12, controls: ['zoomControl', 'fullscreenControl'] });
      waiterMapInstance.current = map;
      if (rd.polyline) {
        const coords = rd.polyline.split(';').map(p => { const [lat, lng] = p.split(','); return [parseFloat(lat), parseFloat(lng)]; });
        if (coords.length >= 2) {
          const polyline = new ymaps.Polyline(coords, {}, { strokeColor: '#3b82f6', strokeWidth: 4, strokeOpacity: 0.8 });
          map.geoObjects.add(polyline);
          const bounds = coords.reduce<[[number, number], [number, number]] | null>((b, c) => { if (!b) return [[c[0], c[1]], [c[0], c[1]]]; return [[Math.min(b[0][0], c[0]), Math.min(b[0][1], c[1])], [Math.max(b[1][0], c[0]), Math.max(b[1][1], c[1])]]; }, null);
          if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 30 });
        }
      }
    });
    return () => { if (waiterMapInstance.current) { waiterMapInstance.current.destroy(); waiterMapInstance.current = null; } };
  }, [ymapsLoaded, returnMapOrder, returningData]);

  const returnWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const apiBase = localStorage.getItem('foodchain_api_url') || '';
    const wsUrl = apiBase.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);
    returnWsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'courier:returning-update') {
          setReturningData(prev => ({ ...prev, [data.orderId]: { courierName: data.courierName, distanceKm: data.distanceKm, durationMin: data.durationMin, eta: data.eta, polyline: data.polyline || '' } }));
        }
        if (data.type === 'courier:returning-cancelled' || data.type === 'courier:returning-arrived') {
          setReturningData(prev => { const n = { ...prev }; delete n[data.orderId]; return n; });
        }
      } catch {}
    };
    return () => { ws.close(); };
  }, []);

  const handleServe = async (orderId: number) => {
    setLoadingOrderId(orderId);
    try {
      const token = localStorage.getItem('foodchain_waiter_token') || '';
      const user = JSON.parse(localStorage.getItem('foodchain_waiter_user') || '{}');
      await api.serveOrder(orderId, user.id);
      onRefresh();
    } catch (e: any) { alert(e.message); }
    setLoadingOrderId(null);
  };

  const handleAssignCourier = async (order: Order) => {
    const courierId = prompt('Введите ID курьера:');
    if (!courierId) return;
    try {
      await api.assignOrderCourier(order.id, Number(courierId), `Курьер #${courierId}`);
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  if (checks.length === 0) {
    return (
      <div className="pb-24 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <ClipboardList size={20} className="text-orange-500" /> Активные заказы
          </h2>
          <button onClick={() => setShowBarcodeScanner(true)} className="p-2 text-zinc-400 hover:text-white transition" title="Сканировать штрихкод">
            <Camera size={18} />
          </button>
        </div>
        <div className="text-center py-16">
          <ClipboardList size={48} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 font-semibold">Нет активных заказов</p>
          <p className="text-xs text-zinc-600 mt-1">Посадите гостей и примите заказ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 px-4 pt-4">
      <h2 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
        <ClipboardList size={20} className="text-orange-500" /> Активные заказы
      </h2>

      <div className="space-y-4">
        {checks.filter(c => c.status === 'open').map(check => (
          <div key={check.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <ClipboardList size={18} className="text-orange-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{check.tableName}</span>
                    <span className="text-xs text-zinc-500">{check.waiterName}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{check.guestCount} гостя</p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-orange-500">{usePrice()(check.total)}</span>
            </div>

            <div className="space-y-2">
              {check.orders?.map(order => (
                <div key={order.id} className="bg-zinc-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-400">Заказ #{order.id}</span>
                      <ItemTimer createdAt={order.createdAt} />
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  {/* Order items */}
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                          ${item.itemStatus === 'ready' ? 'bg-green-500' : item.itemStatus === 'preparing' ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                        <span className="text-zinc-300 truncate">{item.name}</span>
                        {item.options?.length > 0 && (
                          <span className="text-[10px] text-zinc-600 truncate">{item.options.join(', ')}</span>
                        )}
                      </div>
                      <span className="text-zinc-400 ml-2">{usePrice()(item.price * item.quantity)}</span>
                    </div>
                  ))}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {order.status === 'ready' && order.type !== 'delivery' && (
                      <button onClick={() => handleServe(order.id)} disabled={loadingOrderId === order.id}
                        className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-50">
                        {loadingOrderId === order.id ? '...' : <><Check size={14} /> Подать</>}
                      </button>
                    )}
                    {order.status === 'served' && (
                      <>
                        <button onClick={() => onPayOrder(order)}
                          className="flex-1 bg-blue-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                          <Check size={14} /> Принять оплату
                        </button>
                        <TerminalPayButton order={order} onRefresh={onRefresh} />
                      </>
                    )}
                    {order.status === 'ready' && order.type === 'delivery' && (
                      <button onClick={() => handleAssignCourier(order)}
                        className="flex-1 bg-cyan-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                        <Truck size={14} /> Назначить курьера
                      </button>
                    )}
                    {order.status === 'assigned' && (
                      <span className="flex-1 text-center text-xs text-zinc-500 py-2">Курьер назначен</span>
                    )}
                    {(order.status === 'assigned' || order.status === 'en_route') && order.type === 'delivery' && (
                      <button onClick={() => setStaffChatOrder(order)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition">
                        <MessageSquare size={14} /> Чат
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <span className="flex-1 text-center text-xs text-amber-500 py-2 flex items-center justify-center gap-1">
                        <ChefHat size={14} /> Готовится
                      </span>
                    )}
                    {order.status === 'confirmed' && (
                      <span className="flex-1 text-center text-xs text-blue-500 py-2">Принят</span>
                    )}
                  </div>
                  {returningData[order.id] && (
                    <div className="mt-3 bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition" onClick={() => setReturnMapOrder(order.id)}>
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation size={14} className="text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400">Курьер возвращается</span>
                        {ymapsLoaded && returningData[order.id].polyline && <Maximize2 size={12} className="text-blue-400 ml-auto" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{returningData[order.id].courierName}</span>
                        <span>{returningData[order.id].distanceKm.toFixed(1)} км</span>
                        <span>{returningData[order.id].durationMin} мин</span>
                        <span>~{new Date(returningData[order.id].eta).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {staffChatOrder && (
        <StaffChatPopup
          orderId={staffChatOrder.id}
          orderNumber={staffChatOrder.id}
          courierId={staffChatOrder.courierId}
          courierName={staffChatOrder.courierName}
          waiterId={user?.id || 0}
          waiterName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || ''}
          onClose={() => setStaffChatOrder(null)}
        />
      )}

      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Return map modal */}
      {returnMapOrder !== null && returningData[returnMapOrder] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setReturnMapOrder(null)}>
          <div className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden border border-zinc-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-white">Маршрут курьера</h3>
                <p className="text-xs text-zinc-400">{returningData[returnMapOrder].courierName} · {returningData[returnMapOrder].distanceKm.toFixed(1)} км · {returningData[returnMapOrder].durationMin} мин</p>
              </div>
              <button onClick={() => setReturnMapOrder(null)} className="p-2 text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div ref={waiterMapRef} className="w-full h-80" />
          </div>
        </div>
      )}
    </div>
  );
}
