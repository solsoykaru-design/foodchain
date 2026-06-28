import { useState, useEffect, useRef } from 'react';
import * as api from '../api';
import { Truck, Search, Phone, MapPin, User, Star, MessageSquare, Navigation } from 'lucide-react';
import { addToast } from '../ToastContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function DeliveryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showMap, setShowMap] = useState(true);
  const [returningData, setReturningData] = useState<Record<number, { courierId: number; courierName: string; distanceKm: number; durationMin: number; eta: string; lat?: number; lng?: number; polyline?: string }>>({});
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    api.getDeliveryOrders().then(setOrders).catch(() => {});
    api.getUsers().then(setUsers).catch(() => {});
    api.getCouriers().then(setCouriers).catch(() => {});
  }, []);

  // Listen for courier location updates via WebSocket
  useEffect(() => {
    const unsub = api.onEvent('courier:location', (data: any) => {
      setCouriers(prev => prev.map(c =>
        c.id === data.courier_id ? { ...c, latitude: data.latitude, longitude: data.longitude, location_updated_at: new Date().toISOString() } : c
      ));
    });
    return unsub;
  }, []);

  // Listen for courier returning updates + poll for returning data
  useEffect(() => {
    const loc = window.location;
    const wsUrl = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'courier:returning-update') {
          setReturningData(prev => ({ ...prev, [data.orderId]: { courierId: data.courierId || 0, courierName: data.courierName, distanceKm: data.distanceKm, durationMin: data.durationMin, eta: data.eta, lat: data.courierLat, lng: data.courierLng, polyline: data.polyline || '' } }));
        }
        if (data.type === 'courier:returning-cancelled' || data.type === 'courier:returning-arrived') {
          setReturningData(prev => { const n = { ...prev }; delete n[data.orderId]; return n; });
        }
      } catch {}
    };
    const pollId = setInterval(async () => {
      try {
        const rows = await api.getReturningCouriers();
        const map: Record<number, any> = {};
        for (const r of rows) map[r.orderId] = r;
        setReturningData(map);
      } catch {}
    }, 15000);
    return () => { ws.close(); clearInterval(pollId); };
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([55.751244, 37.618423], 11);
    L.tileLayer('https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU', {
      maxZoom: 19,
      attribution: '&copy; Яндекс'
    }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];

    // Courier markers
    couriers.filter(c => c.latitude && c.longitude).forEach(c => {
      const isReturning = Object.values(returningData).some(r => r.courierId === c.id);
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div class="w-8 h-8 ${isReturning ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-lg">C</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const m = L.marker([c.latitude, c.longitude], { icon })
        .addTo(map)
        .bindPopup(`<b>${c.first_name} ${c.last_name || ''}</b><br/>${c.phone || ''}${isReturning ? '<br/><span style="color:#22c55e">Возвращается в ресторан</span>' : ''}`);
      markersRef.current.push(m);
    });

    // Returning courier polylines
    for (const [orderId, rd] of Object.entries(returningData)) {
      if (rd.lat && rd.lng && rd.polyline) {
        const coords = rd.polyline.split(';').map(p => { const [lat, lng] = p.split(','); return [parseFloat(lat), parseFloat(lng)] as [number, number]; });
        if (coords.length >= 2) {
          const polyline = L.polyline(coords, { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
          polylinesRef.current.push(polyline);
        }
      }
    }

    // Order markers (with addresses - approximate)
    orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').forEach(o => {
      // Only show if we have some coordinates (dummy for now)
    });

    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [couriers, orders, returningData]);

  const filtered = orders.filter((o: any) => {
    if (filter !== 'all' && o.status !== filter) return false;
    const q = search.toLowerCase();
    return o.userName?.toLowerCase().includes(q) || o.userPhone?.includes(q) || String(o.id).includes(q);
  });

  const getUserProfile = (phone: string) => users.find((u: any) => u.phone === phone);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Доставка</h2>
          <p className="text-sm text-zinc-500 mt-1">Всего доставок: {orders.length} • Курьеров: {couriers.length}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowMap(!showMap)} className={`p-2 rounded-xl text-xs font-medium transition flex items-center gap-1 ${showMap ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
            <Navigation size={14} /> Карта
          </button>
          {['all', 'assigned', 'en_route', 'delivered'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filter === s ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
              {s === 'all' ? 'Все' : s === 'assigned' ? 'Назначены' : s === 'en_route' ? 'В пути' : 'Доставлены'}
            </button>
          ))}
        </div>
      </div>

      {showMap && (
        <div ref={mapRef} className="w-full h-[300px] rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-0" />
      )}

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, телефону или № заказа..." className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">№</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Клиент</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Телефон</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Адрес</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Сумма</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Курьер</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Возврат</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => {
                const profile = getUserProfile(o.userPhone);
                return (
                  <tr key={o.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="p-3 font-bold text-zinc-900 dark:text-white">#{o.id}</td>
                    <td className="p-3">
                      <button onClick={() => profile && alert(`Клиент: ${profile.name}\nТелефон: ${profile.phone}\nEmail: ${profile.email || '—'}\nВсего заказов: ${profile.visitsCount || 0}\nПотрачено: ${profile.totalSpent || 0}₽`)}
                        className="text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                        <User size={14} /> {o.userName}
                      </button>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      <a href={`tel:${o.userPhone}`} className="flex items-center gap-1 hover:text-blue-500"><Phone size={12} /> {o.userPhone}</a>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {o.address || '—'}</span>
                    </td>
                    <td className="p-3 font-bold text-zinc-900 dark:text-white">{o.total?.toLocaleString()}₽</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        o.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        o.status === 'en_route' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {o.status === 'delivered' ? 'Доставлен' : o.status === 'en_route' ? 'В пути' : 'Назначен'}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400 text-xs">{o.courierName || '—'}</td>
                    <td className="p-3">
                      {returningData[o.id] ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer" onClick={() => { if (returningData[o.id].lat && returningData[o.id].lng && mapInstance.current) { mapInstance.current.setView([returningData[o.id].lat!, returningData[o.id].lng!], 14); } }}>
                          🚗 {returningData[o.id].distanceKm.toFixed(1)} км · {returningData[o.id].durationMin} мин
                        </span>
                      ) : o.status === 'delivered' ? (
                        <span className="text-[10px] text-zinc-400">—</span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-zinc-400 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleString('ru') : ''}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-zinc-400">Нет заказов доставки</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
