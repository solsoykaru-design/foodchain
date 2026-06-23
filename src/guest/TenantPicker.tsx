import { useState, useEffect } from 'react';
import { Store, Search, MapPin, Navigation, Loader, Shield, LogIn, Star, Clock, RotateCcw, X } from 'lucide-react';
import * as api from '../api';

export default function TenantPicker({ onSelect, onClose }: { onSelect: () => void; onClose?: () => void }) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [geoError, setGeoError] = useState('');
  const [manualAddr, setManualAddr] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminTenant, setAdminTenant] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [autoSelectTimer, setAutoSelectTimer] = useState<any>(null);

  const loadNearby = async (lat: number, lng: number) => {
    try {
      const nearby = await api.getNearbyTenants(lat, lng);
      setTenants(nearby);
      if (nearby.length === 1 && !autoSelectTimer) {
        const timer = setTimeout(() => handleSelect(nearby[0]), 2000);
        setAutoSelectTimer(timer);
      }
    } catch { setGeoError('Не удалось загрузить рестораны'); }
    setLoading(false);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Геолокация недоступна. Введите адрес вручную.');
      setShowManual(true);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { loadNearby(pos.coords.latitude, pos.coords.longitude); },
      () => {
        setGeoError('Разрешите доступ к геолокации или введите адрес вручную');
        setShowManual(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => { if (autoSelectTimer) clearTimeout(autoSelectTimer); };
  }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try { setSearchResults(await api.searchTenants(search)); } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (t: any) => {
    localStorage.setItem('foodchain_guest_tenant', JSON.stringify(t));
    onSelect();
  };

  const handleManualSearch = async () => {
    if (manualAddr.length < 3) return;
    setLoading(true);
    try { const results = await api.searchTenants(manualAddr); setSearchResults(results); setTenants([]); } catch {}
    setLoading(false);
  };

  const handleLogoClick = () => {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 5) { setShowAdminLogin(true); setLogoClicks(0); }
    setTimeout(() => setLogoClicks(0), 3000);
  };

  const handleAdminLogin = async () => {
    if (!adminTenant.trim() || !adminLogin.trim() || !adminPassword) {
      setAdminError('Заполните все поля');
      return;
    }
    setAdminError('');
    setAdminLoading(true);
    try {
      const res = await api.tenantLogin(adminTenant.trim(), adminLogin.trim(), adminPassword);
      localStorage.setItem('foodchain_admin_user', JSON.stringify(res.user));
      if (res.token) localStorage.setItem('fc_token', res.token);
      window.location.href = '/admin/';
    } catch (e: any) {
      setAdminError(e.message || 'Ошибка');
    }
    setAdminLoading(false);
  };

  const parseSettings = (t: any) => {
    try { return JSON.parse(t.appSettings || '{}'); } catch { return {}; }
  };
  const getHours = (t: any) => parseSettings(t).workingHours || parseSettings(t).hours || '';
  const getRating = (t: any) => parseSettings(t).rating || 0;

  if (showAdminLogin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl ring-1 ring-zinc-800">
          <div className="text-center mb-4">
            <Shield size={32} className="mx-auto text-zinc-400 mb-2" />
            <h2 className="text-lg font-extrabold text-white">Вход для администратора</h2>
          </div>
          <div className="space-y-3">
            <input value={adminTenant} onChange={e => setAdminTenant(e.target.value)} placeholder="Ресторан" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input value={adminLogin} onChange={e => setAdminLogin(e.target.value)} placeholder="Логин" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Пароль" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            {adminError && <p className="text-red-400 text-xs text-center">{adminError}</p>}
            <button onClick={handleAdminLogin} disabled={adminLoading} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {adminLoading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />} Войти
            </button>
            <button onClick={() => setShowAdminLogin(false)} className="w-full text-zinc-500 text-sm text-center">Назад</button>
          </div>
        </div>
      </div>
    );
  }

  const displayList = search.length >= 2 ? searchResults : tenants;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-y-auto">
      {onClose && (
        <div className="sticky top-0 z-10 flex justify-end p-4">
          <button onClick={onClose} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
      )}
      <div className="flex-1 max-w-lg mx-auto w-full p-4 pt-0">
        <div className="text-center my-8">
          <button onClick={handleLogoClick} className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Store size={32} className="text-white" />
          </button>
          <h1 className="text-2xl font-extrabold text-white">Выберите ресторан</h1>
          <p className="text-zinc-500 text-sm mt-1">Найдём заведения рядом с вами</p>
        </div>

        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск ресторана..."
            className="w-full bg-zinc-800 text-white rounded-xl pl-11 pr-4 py-3 text-sm outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600 focus:ring-orange-500/50" />
        </div>

        {showManual && (
          <div className="flex gap-2 mb-4">
            <input value={manualAddr} onChange={e => setManualAddr(e.target.value)} placeholder="Введите адрес или город"
              className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <button onClick={handleManualSearch} className="px-4 py-2.5 bg-zinc-800 rounded-xl ring-1 ring-zinc-700 text-zinc-300 text-sm hover:bg-zinc-700">Найти</button>
          </div>
        )}

        {!showManual && (
          <button onClick={() => setShowManual(true)} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 mb-4">
            <RotateCcw size={14} /> Ввести адрес вручную
          </button>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={24} className="animate-spin text-zinc-500" />
            <span className="ml-3 text-zinc-500">Поиск ресторанов...</span>
          </div>
        ) : (
          <>
            {geoError && displayList.length === 0 && (
              <div className="bg-zinc-900 rounded-2xl p-5 text-center ring-1 ring-zinc-800 mb-4">
                <MapPin size={24} className="mx-auto text-zinc-500 mb-2" />
                <p className="text-sm text-zinc-400 mb-3">{geoError}</p>
                {navigator.geolocation && (
                  <button onClick={() => window.location.reload()} className="text-orange-500 text-sm font-medium">Повторить</button>
                )}
              </div>
            )}
            {displayList.length === 0 && !loading && !geoError && (
              <div className="text-center py-12">
                <Navigation size={32} className="mx-auto text-zinc-600 mb-2" />
                <p className="text-zinc-500 text-sm">Нет ресторанов поблизости. Попробуйте поискать по названию.</p>
              </div>
            )}
            <div className="space-y-3">
              {displayList.map(t => {
                const hours = getHours(t);
                const rating = getRating(t);
                return (
                  <button key={t.id} onClick={() => handleSelect(t)}
                    className="w-full bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 text-left flex items-center gap-4 active:scale-[0.99] transition-transform hover:ring-zinc-600">
                    {t.photoUrl ? (
                      <img src={t.photoUrl} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shrink-0">
                        <Store size={22} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">{t.name || t.nickname}</div>
                      {t.address && <div className="text-xs text-zinc-500 truncate mt-0.5">{t.address}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        {rating > 0 && <span className="text-xs text-yellow-500 flex items-center gap-1"><Star size={12} /> {rating}</span>}
                        {hours && <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock size={12} /> {hours}</span>}
                      </div>
                    </div>
                    {t.distance !== undefined && (
                      <div className="text-xs text-zinc-500 shrink-0">{t.distance} км</div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
