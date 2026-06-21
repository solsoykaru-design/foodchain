import { useState, useEffect, useRef, useCallback } from 'react';
import type { Order } from '../types';
import * as api from '../api';
import { onEvent } from '../api';
import { Truck, MapPin, Clock, LogOut, Check, X, Navigation, Phone, UserCircle, Wifi, WifiOff, DollarSign, TrendingUp, ArrowLeft, RefreshCw, MessageSquare, Send, Image as ImageIcon, Loader, Star, MessageCircle, Settings, Trash2, Plus, Camera } from 'lucide-react';
import CourierAuth from './CourierAuth';
import BarcodeScanner from '../admin/BarcodeScanner';

const CACHE_KEY = 'foodchain_courier_orders';
const NOTIFIED_KEY = 'foodchain_courier_notified';

function loadNotifiedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set<number>(raw ? JSON.parse(raw) : []);
  } catch { return new Set<number>(); }
}

export default function CourierApp({ onLogout }: { onLogout?: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('foodchain_courier_id'));
  const [courierId, setCourierId] = useState<number>(() => Number(localStorage.getItem('foodchain_courier_id') || 0));
  const [courierName, setCourierName] = useState(() => localStorage.getItem('foodchain_courier_name') || '');
  const [publicSettings, setPublicSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    api.getPublicSettings().then(setPublicSettings).catch(() => {});
  }, []);
  const [orders, setOrders] = useState<Order[]>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
    catch { return []; }
  });
  const [tab, setTab] = useState<'active' | 'history' | 'profile'>('active');
  const [profile, setProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const gpsQueueRef = useRef<Array<{lat: number; lng: number}>>([]);
  const gpsSendingRef = useRef(false);
  const notifSentRef = useRef<Set<number>>(loadNotifiedIds());
  const saveNotifiedIds = useCallback(() => {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifSentRef.current]));
  }, []);

  // ── Load orders with cache ──
  const loadOrders = useCallback(async () => {
    if (!courierId) return;
    try {
      const data = await api.getOrders({ courier_id: courierId });
      const sorted = [...data].sort((a, b) => {
        const aActive = ['assigned', 'en_route'].includes(a.status) ? 0 : 1;
        const bActive = ['assigned', 'en_route'].includes(b.status) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setOrders(sorted);
      localStorage.setItem(CACHE_KEY, JSON.stringify(sorted));
    } catch {}
  }, [courierId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, loadOrders]);

  // ── Socket events ──
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onEvent('order:courier', (order: Order) => {
      if (order.courierId === courierId) {
        setOrders(prev => {
          const exists = prev.find(o => o.id === order.id);
          const next = exists ? prev.map(o => o.id === order.id ? order : o) : [order, ...prev];
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });
        if (!notifSentRef.current.has(order.id)) {
          notifSentRef.current.add(order.id);
          saveNotifiedIds();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Новый заказ #' + order.id, { body: 'Вам назначен заказ на ' + order.address });
          }
        }
      } else {
        setOrders(prev => {
          const next = prev.filter(o => o.id !== order.id);
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });
      }
    });
    const unsub2 = onEvent('order:assigned', (order: Order) => {
      if (order.courierId === courierId) {
        setOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          const next = [order, ...prev];
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });
        if (!notifSentRef.current.has(order.id)) {
          notifSentRef.current.add(order.id);
          saveNotifiedIds();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Назначен заказ #' + order.id, { body: 'Адрес: ' + order.address });
          }
        }
      }
    });
    return () => { unsub(); unsub2(); };
  }, [isLoggedIn, courierId]);

  // ── Staff Chat state ──
  const [staffChatOpen, setStaffChatOpen] = useState(false);
  const [staffChatId, setStaffChatId] = useState<number | null>(null);
  const [staffMessages, setStaffMessages] = useState<any[]>([]);
  const [staffChatText, setStaffChatText] = useState('');
  const [staffChatFile, setStaffChatFile] = useState<File | null>(null);
  const [staffChatSending, setStaffChatSending] = useState(false);
  const staffChatRef = useRef<HTMLDivElement>(null);
  const staffFileRef = useRef<HTMLInputElement>(null);

  // ── Courier-Guest Chat state ──
  const [guestChatOpen, setGuestChatOpen] = useState(false);
  const [guestChatId, setGuestChatId] = useState<number | null>(null);
  const [guestMessages, setGuestMessages] = useState<any[]>([]);
  const [guestChatText, setGuestChatText] = useState('');
  const [guestChatFile, setGuestChatFile] = useState<File | null>(null);
  const [guestChatSending, setGuestChatSending] = useState(false);
  const [guestChatClosed, setGuestChatClosed] = useState(false);
  const [guestTemplates, setGuestTemplates] = useState<any[]>([]);
  const [personalTemplates, setPersonalTemplates] = useState<any[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newPersonalTemplate, setNewPersonalTemplate] = useState('');
  const guestChatRef = useRef<HTMLDivElement>(null);
  const guestChatIdRef = useRef<number | null>(null);
  const guestFileRef = useRef<HTMLInputElement>(null);
  const tmplFileRef = useRef<HTMLInputElement>(null);

  // ── Returning state ──
  const [returnData, setReturnData] = useState<{ orderId: number; distanceKm: number; durationMin: number; eta: string; lat: number; lng: number; polyline?: string } | null>(null);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);
  const returnMapRef = useRef<HTMLDivElement>(null);
  const returnMapInstance = useRef<any>(null);

  // Load Yandex Maps JS API
  useEffect(() => {
    if (typeof ymaps !== 'undefined') { setYmapsLoaded(true); return; }
    const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
    fetch(apiBase + '/api/settings').then(r => r.json()).then(settings => {
      const key = settings.yandex_maps_api_key || '';
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
      script.onload = () => setYmapsLoaded(true);
      document.head.appendChild(script);
    }).catch(() => {});
  }, []);

  // Init mini-map when returnData changes
  useEffect(() => {
    if (!ymapsLoaded || !returnData || !returnMapRef.current) return;
    if (returnMapInstance.current) { returnMapInstance.current.destroy(); returnMapInstance.current = null; }
    ymaps.ready(() => {
      const rc = returnMapRef.current; if (!rc) return;
      const centerLat = returnData.lat;
      const centerLng = returnData.lng;
      const map = new ymaps.Map(rc, { center: [centerLat, centerLng], zoom: 12, controls: [] });
      returnMapInstance.current = map;
      // Add courier marker
      const courierPlacemark = new ymaps.Placemark([centerLat, centerLng], {}, { preset: 'islands#greenDotIcon', iconColor: '#22c55e' });
      map.geoObjects.add(courierPlacemark);
      // Add route polyline if available
      if (returnData.polyline) {
        const coords = returnData.polyline.split(';').map(p => { const [lat, lng] = p.split(','); return [parseFloat(lat), parseFloat(lng)]; });
        if (coords.length >= 2) {
          const polyline = new ymaps.Polyline(coords, {}, { strokeColor: '#3b82f6', strokeWidth: 4, strokeOpacity: 0.8 });
          map.geoObjects.add(polyline);
          // Fit map to bounds
          const bounds = coords.reduce<[[number, number], [number, number]] | null>((b, c) => { if (!b) return [[c[0], c[1]], [c[0], c[1]]]; return [[Math.min(b[0][0], c[0]), Math.min(b[0][1], c[1])], [Math.max(b[1][0], c[0]), Math.max(b[1][1], c[1])]]; }, null);
          if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 30 });
        }
      }
    });
    return () => { if (returnMapInstance.current) { returnMapInstance.current.destroy(); returnMapInstance.current = null; } };
  }, [ymapsLoaded, returnData]);

  // GPS polling every 15s while returning
  const gpsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (returnData && navigator.geolocation) {
      const sendGps = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          api.courierSendLocation(courierId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
        }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 });
      };
      sendGps();
      gpsPollRef.current = setInterval(sendGps, 15000);
    } else {
      if (gpsPollRef.current) { clearInterval(gpsPollRef.current); gpsPollRef.current = null; }
    }
    return () => { if (gpsPollRef.current) { clearInterval(gpsPollRef.current); gpsPollRef.current = null; } };
  }, [returnData, courierId]);

  // ── Staff chat WS + returning WS ──
  const staffWsRef = useRef<WebSocket | null>(null);
  const staffChatIdRef = useRef<number | null>(null);
  useEffect(() => { staffChatIdRef.current = staffChatId; }, [staffChatId]);
  useEffect(() => {
    if (!isLoggedIn) return;
    const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
    const wsUrl = apiBase.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);
    staffWsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe:waiter', waiterId: courierId }));
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const currentId = staffChatIdRef.current;
        if (data.type === 'staff-chat:message' && currentId !== null && data.chatId === currentId) {
          setStaffMessages(prev => {
            if (prev.some(x => x.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        if (data.type === 'courier:returning-update') {
          setReturnData({ orderId: data.orderId, distanceKm: data.distanceKm, durationMin: data.durationMin, eta: data.eta, lat: data.courierLat, lng: data.courierLng, polyline: data.polyline || '' });
        }
        if (data.type === 'courier:returning-cancelled' || data.type === 'courier:returning-arrived') {
          setReturnData(null);
        }
      } catch {}
    };
    return () => { ws.close(); };
  }, [isLoggedIn, courierId]);

  // ── Courier-Guest chat WS ──
  useEffect(() => { guestChatIdRef.current = guestChatId; }, [guestChatId]);

  useEffect(() => {
    const ws = staffWsRef.current;
    if (!ws) return;
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const currentId = guestChatIdRef.current;
        if (data.type === 'cg-chat:message' && currentId !== null && data.chatId === currentId) {
          setGuestMessages(prev => prev.some(x => x.id === data.message.id) ? prev : [...prev, data.message]);
        }
        if (data.type === 'cg-chat:closed' && currentId !== null && data.data?.id === currentId) {
          setGuestChatClosed(true);
        }
      } catch {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, []);

  useEffect(() => { guestChatRef.current?.scrollTo(0, guestChatRef.current.scrollHeight); }, [guestMessages]);

  // ── Request notification permission ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Pull-to-refresh ──
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // ── GPS tracking ──
  const startGps = useCallback(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        gpsQueueRef.current.push({ lat, lng });
        if (!gpsSendingRef.current) sendGpsBatch();
      },
      err => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    setGpsWatchId(id);
  }, []);

  const stopGps = useCallback(() => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      setGpsWatchId(null);
    }
  }, [gpsWatchId]);

  const sendGpsBatch = async () => {
    gpsSendingRef.current = true;
    const batch = gpsQueueRef.current.splice(0);
    for (const point of batch) {
      try {
        await api.courierSendLocation(courierId, point.lat, point.lng);
      } catch {}
    }
    if (gpsQueueRef.current.length > 0) {
      sendGpsBatch();
    } else {
      gpsSendingRef.current = false;
    }
  };

  useEffect(() => {
    if (isOnline) startGps();
    else stopGps();
    return stopGps;
  }, [isOnline, startGps, stopGps]);

  // ── Online toggle ──
  const toggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    try {
      await api.courierToggleOnline(courierId, next);
    } catch { setIsOnline(!next); }
  };

  // ── Profile ──
  useEffect(() => {
    if (!isLoggedIn || tab !== 'profile') return;
    api.getCourierProfile(courierId).then(p => {
      setProfile(p);
      setIsOnline(p.isOnline);
    }).catch(() => {});
  }, [isLoggedIn, courierId, tab]);

  // ── Auth ──
  const handleLogin = (id: number, name: string) => {
    localStorage.setItem('foodchain_courier_id', String(id));
    localStorage.setItem('foodchain_courier_name', name);
    setCourierId(id);
    setCourierName(name);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    stopGps();
    if (isOnline) api.courierToggleOnline(courierId, false).catch(() => {});
    localStorage.removeItem('foodchain_courier_id');
    localStorage.removeItem('foodchain_courier_name');
    setIsLoggedIn(false);
    onLogout?.();
  };

  const updateStatus = async (orderId: number, status: string, note: string) => {
    try {
      await api.updateOrderStatus(orderId, status as any, note);
      setSelectedOrder(null);
      await loadOrders();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    if (!notifSentRef.current.has(order.id)) {
      notifSentRef.current.add(order.id);
      saveNotifiedIds();
    }
  };

  const handleReject = async (orderId: number) => {
    try {
      await api.assignOrder(orderId, 0, '', 0);
      setOrders(prev => {
        const next = prev.filter(o => o.id !== orderId);
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
      setSelectedOrder(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const handleNavigate = (address: string) => {
    window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`, '_blank');
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowBarcodeScanner(false);
    if (selectedOrder) {
      try {
        await api.updateOrderStatus(selectedOrder.id, 'delivered', 'Заказ доставлен (по штрихкоду)');
        setSelectedOrder(null);
        await loadOrders();
        return;
      } catch (e: any) { alert(e.message); return; }
    }
    const orderId = parseInt(barcode, 10);
    if (!isNaN(orderId)) {
      const found = orders.find(o => o.id === orderId && ['assigned', 'en_route'].includes(o.status));
      if (found) {
        try {
          await api.updateOrderStatus(found.id, 'delivered', 'Заказ доставлен (по штрихкоду)');
          await loadOrders();
          return;
        } catch (e: any) { alert(e.message); return; }
      }
    }
    alert('Заказ с таким штрихкодом не найден');
  };

  if (!isLoggedIn) {
    return <CourierAuth onLogin={handleLogin} />;
  }

  const activeOrders = orders.filter(o => ['assigned', 'en_route'].includes(o.status));
  const historyOrders = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');

  const openStaffChat = async (orderId: number) => {
    setStaffChatOpen(true);
    try {
      const chats = await api.getStaffChats({ order_id: orderId });
      let chat = chats.find(c => c.status === 'open');
      if (!chat) {
        chat = await api.createStaffChat({
          order_id: orderId,
          courier_id: courierId,
          courier_name: courierName,
          waiter_id: 0,
        });
      }
      setStaffChatId(chat.id);
      const msgs = await api.getStaffChatMessages(chat.id);
      setStaffMessages(msgs);
    } catch {}
  };

  const openGuestChat = async (orderId: number) => {
    setGuestChatOpen(true);
    setGuestChatClosed(false);
    setGuestMessages([]);
    try {
      const chats = await api.getCourierGuestChats({ order_id: orderId });
      let chat = chats.find((c: any) => c.status === 'open');
      if (!chat) {
        chat = await api.createCourierGuestChat({
          order_id: orderId,
          courier_id: courierId,
          courier_name: courierName,
        });
      }
      setGuestChatId(chat.id);
      const msgs = await api.getCourierGuestChatMessages(chat.id);
      setGuestMessages(msgs);
      setGuestChatClosed(chat.status === 'closed');

      // Load templates
      const templates = await api.getCourierTemplates({ user_id: courierId, tenant_id: 1 });
      setGuestTemplates(templates.system || []);
      setPersonalTemplates(templates.personal || []);

      // Subscribe via WS
      const ws = staffWsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe:chat', chatId: chat.id }));
      }
    } catch (e) { console.error('Open guest chat error', e); }
  };

  const sendStaffChatMessage = async (order: Order) => {
    if (!staffChatText.trim() && !staffChatFile) return;
    setStaffChatSending(true);
    const text = staffChatText;
    setStaffChatText('');
    const f = staffChatFile;
    setStaffChatFile(null);
    try {
      let fileUrl = '';
      if (f) {
        const upload = await api.uploadStaffChatFile(f);
        fileUrl = upload.url;
      }
      if (!staffChatId) {
        const chats = await api.getStaffChats({ order_id: order.id });
        let chat = chats.find(c => c.status === 'open');
        if (!chat) chat = await api.createStaffChat({ order_id: order.id, courier_id: courierId, courier_name: courierName });
        setStaffChatId(chat.id);
      }
      const saved = await api.sendStaffChatMessage(staffChatId!, {
        sender_id: courierId, sender_type: 'courier', sender_name: courierName, message: text, file_url: fileUrl,
      });
      setStaffMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]);
    } catch {} finally { setStaffChatSending(false); }
  };

  const sendGuestChatMessage = async (order: any) => {
    if (!guestChatText.trim() && !guestChatFile) return;
    setGuestChatSending(true);
    const text = guestChatText;
    setGuestChatText('');
    const f = guestChatFile;
    setGuestChatFile(null);
    try {
      let fileUrl = '';
      if (f) {
        const formData = new FormData();
        formData.append('file', f);
        const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
        const res = await fetch(`${apiBase}/api/chats/upload`, { method: 'POST', body: formData });
        const d = await res.json();
        fileUrl = d.url;
      }
      if (!guestChatId) {
        const chats = await api.getCourierGuestChats({ order_id: order.id });
        let chat = chats.find((c: any) => c.status === 'open');
        if (!chat) chat = await api.createCourierGuestChat({ order_id: order.id, courier_id: courierId, courier_name: courierName });
        setGuestChatId(chat.id);
      }
      const saved = await api.sendCourierGuestChatMessage(guestChatId!, {
        sender_id: courierId, sender_type: 'courier', sender_name: courierName,
        message: text, file_url: fileUrl,
      });
      setGuestMessages(prev => [...prev, saved]);
    } catch (e) { console.error('Send guest chat error', e); } finally { setGuestChatSending(false); }
  };

  const sendGuestChatTemplate = async (order: any, templateText: string) => {
    setGuestChatText(templateText);
    await sendGuestChatMessage(order);
  };

  useEffect(() => { staffChatRef.current?.scrollTo(0, staffChatRef.current.scrollHeight); }, [staffMessages]);

  // ── Order detail screen ──
  if (selectedOrder) {
    const order = selectedOrder;
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
        <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedOrder(null)} className="p-1 text-zinc-500 hover:text-zinc-700"><ArrowLeft size={20} /></button>
          <h1 className="font-bold text-lg">Заказ #{order.id}</h1>
          <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${
            order.status === 'assigned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            order.status === 'en_route' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {order.status === 'assigned' ? 'Назначен' : order.status === 'en_route' ? 'В пути' : order.status === 'delivered' ? 'Доставлен' : 'Отменён'}
          </span>
        </div>

        {publicSettings.access_mode === 'demo' && (
          <div className="bg-amber-500 px-4 py-1.5 text-xs text-black font-bold text-center">
            ДЕМО-ВЕРСИЯ · данные не настоящие
          </div>
        )}

        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
            <h3 className="font-semibold text-sm text-zinc-500 mb-3">Клиент</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Имя</span><span>{order.userName}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Телефон</span>
                <button onClick={() => handleCall(order.userPhone || '')} className="flex items-center gap-1 text-green-600 font-medium">
                  <Phone size={14} /> {order.userPhone || ''}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Сумма</span>
                <span className="font-bold text-green-500">{order.total}₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Оплата</span>
                <span>{order.isPaid ? '✅ Оплачено' : '⏳ Ожидание'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
            <h3 className="font-semibold text-sm text-zinc-500 mb-3">Адрес доставки</h3>
            <div className="flex items-center gap-2 text-sm mb-3">
              <MapPin size={16} className="text-zinc-400 shrink-0" />
              <span>{order.address || 'Адрес не указан'}</span>
            </div>
            {order.address && (
              <button onClick={() => handleNavigate(order.address || '')} className="w-full border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <Navigation size={16} /> Построить маршрут
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
            <h3 className="font-semibold text-sm text-zinc-500 mb-3">Состав заказа</h3>
            <div className="space-y-2">
              {order.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity}</span>
                  <span className="font-medium">{item.price * item.quantity}₽</span>
                </div>
              ))}
              <div className="border-t border-zinc-100 dark:border-zinc-700 pt-2 flex justify-between font-bold">
                <span>Итого</span>
                <span className="text-green-500">{order.total}₽</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {order.status === 'assigned' && (
              <>
                <button onClick={() => handleReject(order.id)}
                  className="flex-1 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold py-3 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20">
                  <X size={16} className="inline mr-1" /> Отказаться
                </button>
                <button onClick={() => updateStatus(order.id, 'en_route', 'Курьер выехал')}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl text-sm">
                  <Navigation size={16} className="inline mr-1" /> Взять в работу
                </button>
              </>
            )}
            {order.status === 'en_route' && (
              <>
                <button onClick={() => handleCall(order.userPhone || '')}
                  className="flex-1 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl text-sm">
                  <Phone size={16} className="inline mr-1" /> Позвонить
                </button>
                <button onClick={() => handleNavigate(order.address || '')}
                  className="flex-1 border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-medium py-3 rounded-xl text-sm">
                  <Navigation size={16} className="inline mr-1" /> Маршрут
                </button>
                <button onClick={() => setShowBarcodeScanner(true)}
                  className="flex-1 border border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-medium py-3 rounded-xl text-sm">
                  <Camera size={16} className="inline mr-1" /> По штрихкоду
                </button>
                <button onClick={() => updateStatus(order.id, 'delivered', 'Заказ доставлен')}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl text-sm">
                  <Check size={16} className="inline mr-1" /> Доставлен
                </button>
              </>
            )}
          </div>
          {(order.status === 'assigned' || order.status === 'en_route') && (
            <div className="flex gap-2">
              <button onClick={() => openStaffChat(order.id)}
                className="flex-1 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <MessageSquare size={16} /> Чат с официантом
              </button>
              <button onClick={() => openGuestChat(order.id)}
                className="flex-1 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <MessageCircle size={16} /> Чат с гостем
              </button>
            </div>
          )}
          {order.status === 'delivered' && returnData?.orderId === order.id && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Navigation size={18} className="text-blue-500" />
                <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-300">Возвращаюсь в ресторан</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{returnData.distanceKm.toFixed(1)}</p>
                  <p className="text-[10px] text-zinc-500">км</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{returnData.durationMin}</p>
                  <p className="text-[10px] text-zinc-500">мин</p>
                </div>
              </div>
              <div className="text-xs text-zinc-500 text-center">
                {new Date(returnData.eta).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — примерное время прибытия
              </div>
              {ymapsLoaded && returnData.polyline && (
                <div ref={returnMapRef} className="w-full h-32 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800" />
              )}
              <div className="flex gap-2">
                <button onClick={async () => { try { await api.cancelCourierReturn(order.id); setReturnData(null); } catch {} }}
                  className="flex-1 border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 font-medium py-2.5 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Отменить возврат
                </button>
                <button onClick={async () => { try { await api.markCourierArrived(order.id); setReturnData(null); } catch {} }}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl text-sm">
                  Прибыл в ресторан
                </button>
              </div>
            </div>
          )}
          {order.status === 'delivered' && (!returnData || returnData.orderId !== order.id) && (
            <button onClick={async () => {
              if (!navigator.geolocation) return alert('Геолокация недоступна');
              navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                  const result = await api.startCourierReturn(order.id, pos.coords.latitude, pos.coords.longitude);
                  setReturnData({ orderId: order.id, distanceKm: result.distanceKm, durationMin: result.durationMin, eta: result.eta, lat: pos.coords.latitude, lng: pos.coords.longitude, polyline: result.polyline || '' });
                  // Auto-send message to staff chat
                  try {
                    const chats = await api.getStaffChats({ order_id: order.id });
                    const chat = chats.find(c => c.status === 'open') || chats[0];
                    if (chat) await api.sendStaffChatMessage(chat.id, { sender_id: courierId, sender_type: 'courier', sender_name: courierName, message: `🚗 Возвращаюсь в ресторан, буду через ${result.durationMin} мин, ${result.distanceKm.toFixed(1)} км`, file_url: '' });
                  } catch {}
                } catch {}
              }, () => alert('Не удалось определить местоположение'), { enableHighAccuracy: true, timeout: 10000 });
            }}
              className="w-full border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-green-50 dark:hover:bg-green-900/20">
              <Navigation size={16} /> Возвращаюсь в ресторан
            </button>
          )}
        </div>

        {/* Barcode Scanner */}
        {showBarcodeScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowBarcodeScanner(false)}
          />
        )}

        {/* Staff Chat Modal */}
        {staffChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setStaffChatOpen(false)}>
            <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-md sm:rounded-2xl sm:mx-4 max-h-[80vh] flex flex-col shadow-xl border border-zinc-200 dark:border-zinc-800" style={{ height: '70vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <button onClick={() => setStaffChatOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><ArrowLeft size={20} /></button>
                <h3 className="font-bold text-sm">Чат с официантом</h3>
                <span className="ml-auto text-[10px] text-zinc-400">Заказ #{order.id}</span>
              </div>
              <div ref={staffChatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {staffMessages.length === 0 && (
                  <div className="text-center py-12 text-zinc-400 text-sm">Начните диалог с официантом</div>
                )}
                {staffMessages.map(m => (
                  <div key={m.id} className={`flex ${m.senderType === 'courier' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'courier' ? 'bg-green-500 text-white rounded-br-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-bl-md'}`}>
                  {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-32 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
                  {m.messageType === 'location' && m.locationData ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin size={16} />
                        <span className="text-sm font-medium">Местоположение</span>
                      </div>
                      <p className="text-xs opacity-80">{m.locationData.lat.toFixed(6)}, {m.locationData.lng.toFixed(6)}</p>
                      <a href={`https://yandex.ru/maps/?rtext=~${m.locationData.lat},${m.locationData.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline opacity-90 hover:opacity-100">
                        <Navigation size={14} /> Построить маршрут
                      </a>
                    </div>
                  ) : m.message ? <p className="text-sm whitespace-pre-wrap">{m.message}</p> : null}
                      <p className={`text-[10px] mt-1 ${m.senderType === 'courier' ? 'text-white/60' : 'text-zinc-400'}`}>
                        {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                {staffChatFile && (
                  <div className="mb-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-2 flex items-center gap-2">
                    <span className="text-xs text-zinc-500 truncate flex-1">{staffChatFile.name}</span>
                    <button onClick={() => setStaffChatFile(null)} className="text-zinc-400 hover:text-zinc-600"><X size={14} /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => staffFileRef.current?.click()} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-600">
                    <ImageIcon size={18} />
                  </button>
                  <input ref={staffFileRef} type="file" accept="image/*" className="hidden" onChange={e => setStaffChatFile(e.target.files?.[0] || null)} />
                  <button onClick={() => { if (!navigator.geolocation || !staffChatId) return; navigator.geolocation.getCurrentPosition(async (pos) => { const lat = pos.coords.latitude; const lng = pos.coords.longitude; setStaffChatSending(true); try { const locationData = { lat, lng }; const saved = await api.sendStaffChatMessage(staffChatId!, { sender_id: courierId, sender_type: 'courier', sender_name: courierName, message: '', file_url: '', message_type: 'location', location_data: locationData }); setStaffMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]); } catch {} finally { setStaffChatSending(false); } }, () => {}, { enableHighAccuracy: true, timeout: 10000 }); }} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-600" title="Геолокация">
                    <MapPin size={18} />
                  </button>
                  <input value={staffChatText} onChange={e => setStaffChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !staffChatSending && sendStaffChatMessage(order)} placeholder="Сообщение..." className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-300 dark:ring-zinc-700 focus:ring-green-500 placeholder-zinc-400" />
                  <button onClick={() => sendStaffChatMessage(order)} disabled={staffChatSending || (!staffChatText.trim() && !staffChatFile)} className="w-11 h-11 bg-green-500 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50">
                    {staffChatSending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Courier-Guest Chat Modal */}
        {guestChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setGuestChatOpen(false)}>
            <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-md sm:rounded-2xl sm:mx-4 max-h-[80vh] flex flex-col shadow-xl border border-zinc-200 dark:border-zinc-800" style={{ height: '70vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <button onClick={() => setGuestChatOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><ArrowLeft size={20} /></button>
                <h3 className="font-bold text-sm">Чат с гостем</h3>
                <span className="ml-auto text-[10px] text-zinc-400">Заказ #{order.id}</span>
                <button onClick={() => setShowTemplateManager(true)} className="p-1 text-zinc-400 hover:text-blue-500" title="Настроить шаблоны">
                  <Settings size={16} />
                </button>
              </div>

              {/* Templates bar */}
              {guestTemplates.length > 0 && !guestChatClosed && (
                <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto shrink-0">
                  <div className="flex gap-1.5">
                    {guestTemplates.slice(0, 5).map((t: any) => (
                      <button key={t.id} onClick={() => sendGuestChatTemplate(order, t.text)}
                        className="whitespace-nowrap text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-1.5 rounded-full font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition shrink-0">
                        {t.text.length > 25 ? t.text.slice(0, 25) + '…' : t.text}
                      </button>
                    ))}
                    {personalTemplates.length > 0 && guestTemplates.length > 0 && <div className="w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />}
                    {personalTemplates.slice(0, 2).map((t: any) => (
                      <button key={t.id} onClick={() => sendGuestChatTemplate(order, t.text)}
                        className="whitespace-nowrap text-[11px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-full font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition shrink-0">
                        {t.text.length > 25 ? t.text.slice(0, 25) + '…' : t.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={guestChatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {guestMessages.length === 0 && (
                  <div className="text-center py-12 text-zinc-400 text-sm">Начните диалог с гостем</div>
                )}
                {guestMessages.map(m => (
                  <div key={m.id} className={`flex ${m.senderType === 'courier' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'courier' ? 'bg-blue-500 text-white rounded-br-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-bl-md'}`}>
                      {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-32 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
                      {m.messageType === 'location' && m.locationData ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1"><MapPin size={16} /><span className="text-sm font-medium">Местоположение</span></div>
                          <p className="text-xs opacity-80">{m.locationData.lat.toFixed(6)}, {m.locationData.lng.toFixed(6)}</p>
                          <a href={`https://yandex.ru/maps/?rtext=~${m.locationData.lat},${m.locationData.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline opacity-90"><Navigation size={14} /> Построить маршрут</a>
                        </div>
                      ) : m.message ? <p className="text-sm whitespace-pre-wrap">{m.message}</p> : null}
                      <p className={`text-[10px] mt-1 ${m.senderType === 'courier' ? 'text-white/60' : 'text-zinc-400'}`}>
                        {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {guestChatClosed && (
                  <div className="text-center py-4 text-zinc-500 text-sm">Чат закрыт</div>
                )}
              </div>

              {!guestChatClosed && (
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                  {guestChatFile && (
                    <div className="mb-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-500 truncate flex-1">{guestChatFile.name}</span>
                      <button onClick={() => setGuestChatFile(null)} className="text-zinc-400 hover:text-zinc-600"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => guestFileRef.current?.click()} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-600">
                      <ImageIcon size={18} />
                    </button>
                    <input ref={guestFileRef} type="file" accept="image/*" className="hidden" onChange={e => setGuestChatFile(e.target.files?.[0] || null)} />
                    <button onClick={() => { if (!navigator.geolocation || !guestChatId) return; navigator.geolocation.getCurrentPosition(async (pos) => { setGuestChatSending(true); try { const locData = { lat: pos.coords.latitude, lng: pos.coords.longitude }; const saved = await api.sendCourierGuestChatMessage(guestChatId!, { sender_id: courierId, sender_type: 'courier', sender_name: courierName, message: '', file_url: '', message_type: 'location', location_data: locData }); setGuestMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]); } catch {} finally { setGuestChatSending(false); } }, () => {}, { enableHighAccuracy: true, timeout: 10000 }); }} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-600" title="Геолокация">
                      <MapPin size={18} />
                    </button>
                    <input value={guestChatText} onChange={e => setGuestChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !guestChatSending && sendGuestChatMessage(order)} placeholder="Сообщение..." className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-300 dark:ring-zinc-700 focus:ring-blue-500 placeholder-zinc-400" />
                    <button onClick={() => sendGuestChatMessage(order)} disabled={guestChatSending || (!guestChatText.trim() && !guestChatFile)} className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50">
                      {guestChatSending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Template Manager Modal */}
        {showTemplateManager && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTemplateManager(false)}>
            <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-md sm:rounded-2xl sm:mx-4 max-h-[80vh] flex flex-col shadow-xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <button onClick={() => setShowTemplateManager(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><ArrowLeft size={20} /></button>
                <h3 className="font-bold text-sm">Настройка шаблонов</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* System templates */}
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Системные шаблоны</h4>
                  <div className="space-y-1.5">
                    {guestTemplates.map(t => (
                      <div key={t.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-sm text-zinc-700 dark:text-zinc-300">{t.text}</div>
                    ))}
                  </div>
                </div>

                {/* Personal templates */}
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Мои шаблоны</h4>
                  {personalTemplates.length === 0 && <p className="text-xs text-zinc-500">У вас нет личных шаблонов</p>}
                  <div className="space-y-1.5">
                    {personalTemplates.map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2.5 text-sm text-blue-700 dark:text-blue-300">
                        <span className="flex-1">{t.text}</span>
                        <button onClick={async () => { try { await api.deleteCourierPersonalTemplate(t.id); setPersonalTemplates(prev => prev.filter(x => x.id !== t.id)); } catch {} }} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add personal template */}
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Добавить шаблон</h4>
                  <div className="flex gap-2">
                    <input value={newPersonalTemplate} onChange={e => setNewPersonalTemplate(e.target.value)} maxLength={200} placeholder="Текст шаблона..." className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-300 dark:ring-zinc-700 focus:ring-blue-500 placeholder-zinc-400" />
                    <button onClick={async () => { if (!newPersonalTemplate.trim()) return; try { const saved = await api.createCourierPersonalTemplate(courierId, newPersonalTemplate); setPersonalTemplates(prev => [...prev, saved]); setNewPersonalTemplate(''); } catch {} }} disabled={!newPersonalTemplate.trim()} className="bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-blue-600">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white pb-20">
      <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">C</div>
          <div>
            <h1 className="font-bold text-lg">{publicSettings.app_name || 'Курьер'}</h1>
            <p className="text-[10px] text-zinc-500">{courierName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleOnline} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'На линии' : 'Не на линии'}
          </button>
          <button onClick={() => setShowBarcodeScanner(true)} className="p-2 text-zinc-400 hover:text-purple-500 transition" title="Сканировать штрихкод">
            <Camera size={18} />
          </button>
          <button onClick={handleRefresh} className={`p-2 text-zinc-400 hover:text-green-500 transition ${refreshing ? 'animate-spin' : ''}`}>
            <RefreshCw size={18} />
          </button>
          <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-500"><LogOut size={18} /></button>
        </div>
      </div>

      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <button onClick={() => setTab('active')} className={`flex-1 py-3 text-sm font-medium ${tab === 'active' ? 'border-b-2 border-green-500 text-green-500' : 'text-zinc-500'}`}>
          Активные ({activeOrders.length})
        </button>
        <button onClick={() => setTab('history')} className={`flex-1 py-3 text-sm font-medium ${tab === 'history' ? 'border-b-2 border-green-500 text-green-500' : 'text-zinc-500'}`}>
          История ({historyOrders.length})
        </button>
        <button onClick={() => setTab('profile')} className={`flex-1 py-3 text-sm font-medium ${tab === 'profile' ? 'border-b-2 border-green-500 text-green-500' : 'text-zinc-500'}`}>
          Профиль
        </button>
      </div>

      {publicSettings.access_mode === 'demo' && (
        <div className="bg-amber-500 border-b border-amber-600 px-4 py-2 text-xs text-black font-bold text-center">
          ДЕМО-ВЕРСИЯ · данные не настоящие
        </div>
      )}
      {!navigator.onLine && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 text-center">
          Нет подключения к интернету. Данные могут быть неактуальны.
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {tab === 'active' && activeOrders.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <Truck size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-medium">Нет назначенных заказов</p>
            <p className="text-xs mt-1">Ожидайте назначения от администратора</p>
            {publicSettings.working_time_start && publicSettings.working_time_end && (
              <p className="text-[10px] text-zinc-500 mt-3">Рабочие часы: {publicSettings.working_time_start} — {publicSettings.working_time_end}</p>
            )}
          </div>
        )}

        {tab === 'active' && activeOrders.map(order => (
          <div key={order.id} onClick={() => handleViewOrder(order)} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-4 cursor-pointer active:scale-[0.99] transition-transform">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-lg">#{order.id}</div>
                <div className="text-xs text-zinc-400">{order.userName} • {order.userPhone}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-500">{order.total}₽</div>
                <div className="text-[10px] text-zinc-400">оплата: {order.isPaid ? '✅' : '⏳'}</div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 mb-3 text-xs">
              <div className="flex items-center gap-1 text-zinc-500 mb-1">
                <MapPin size={12} /> {order.address || 'Адрес не указан'}
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {order.items?.map((item: any, i: number) => (
                  <span key={i} className="bg-white dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">{item.name}×{item.quantity}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                order.status === 'assigned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {order.status === 'assigned' ? 'Назначен' : 'В пути'}
              </span>
              <span className="text-[10px] text-zinc-400">{new Date(order.createdAt).toLocaleString('ru')}</span>
            </div>
          </div>
        ))}

        {tab === 'history' && (
          <div className="space-y-3">
            {historyOrders.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <Clock size={48} className="mx-auto mb-4 opacity-30" />
                <p>История доставок пуста</p>
              </div>
            )}
            {historyOrders.map(order => (
              <div key={order.id} onClick={() => handleViewOrder(order)} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-4 opacity-70 cursor-pointer active:scale-[0.99] transition-transform">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold">#{order.id}</span>
                    <span className="text-xs text-zinc-400 ml-2">{order.userName}</span>
                  </div>
                  <span className={`text-xs font-semibold ${order.status === 'delivered' ? 'text-green-600' : 'text-red-600'}`}>
                    {order.status === 'delivered' ? '✅ Доставлен' : '❌ Отменён'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">{order.address}</p>
                <p className="text-xs text-zinc-400 mt-1">{order.total}₽ • {new Date(order.createdAt).toLocaleString('ru')}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-4">
            {!profile ? (
              <div className="text-center py-12 text-zinc-400">Загрузка...</div>
            ) : (
              <>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
                    {profile.firstName?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <h2 className="text-xl font-bold">{profile.firstName} {profile.lastName || ''}</h2>
                  <p className="text-sm text-zinc-500 mt-1">@{profile.username}</p>
                  {profile.phone && <p className="text-sm text-zinc-500">{profile.phone}</p>}
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
                  <h3 className="font-semibold text-sm text-zinc-500 mb-3">Статистика сегодня</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
                      <TrendingUp size={20} className="mx-auto text-green-500 mb-1" />
                      <div className="text-lg font-bold">{profile.deliveredToday || 0}</div>
                      <div className="text-[10px] text-zinc-500">Доставок</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
                      <DollarSign size={20} className="mx-auto text-yellow-500 mb-1" />
                      <div className="text-lg font-bold">{profile.earningsToday || 0}₽</div>
                      <div className="text-[10px] text-zinc-500">Заработано</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
                      <Navigation size={20} className="mx-auto text-blue-500 mb-1" />
                      <div className="text-lg font-bold">{profile.kmToday || 0} км</div>
                      <div className="text-[10px] text-zinc-500">Пройдено</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
                      <Clock size={20} className="mx-auto text-purple-500 mb-1" />
                      <div className="text-lg font-bold">{Math.floor((profile.onlineMinutes || 0) / 60)}ч {profile.onlineMinutes % 60}м</div>
                      <div className="text-[10px] text-zinc-500">На линии</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
                  <h3 className="font-semibold text-sm text-zinc-500 mb-3">Информация</h3>
                  <div className="space-y-2 text-sm">
                    {profile.phone && <div className="flex justify-between"><span className="text-zinc-500">Телефон</span><span>{profile.phone}</span></div>}
                    {profile.email && <div className="flex justify-between"><span className="text-zinc-500">Email</span><span>{profile.email}</span></div>}
                    <div className="flex justify-between"><span className="text-zinc-500">Статус</span><span className={isOnline ? 'text-green-600' : 'text-zinc-400'}>{isOnline ? 'На линии' : 'Не на линии'}</span></div>
                  </div>
                </div>

                {profile.salaryType && Array.isArray(profile.salaryType) && profile.salaryType.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5">
                    <h3 className="font-semibold text-sm text-zinc-500 mb-3">Зарплата</h3>
                    <div className="space-y-2 text-sm">
                      {profile.salaryType.map((t: string) => {
                        const val = profile.salaryValue?.[t] || 0;
                        const labels: Record<string, string> = { per_order: 'За заказ', salary: 'Оклад (в день)', per_km: 'За км' };
                        return (
                          <div key={t} className="flex justify-between">
                            <span className="text-zinc-500">{labels[t] || t}</span>
                            <span className="font-semibold">{val.toLocaleString()}₽</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button onClick={handleLogout} className="w-full border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold py-3 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20">
                  Выйти
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
}
