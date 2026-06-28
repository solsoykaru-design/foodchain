import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChefHat, Clock, Check, X, AlertTriangle, Bell, RefreshCw,
  ListOrdered, Timer, ChevronRight, TrendingUp, Users,
  ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';
import * as api from '../api';

export default function KitchenApp({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [serverStepCompletions, setServerStepCompletions] = useState<Record<string, number[]>>({});
  const [showStepsGlobal, setShowStepsGlobal] = useState(false);
  const [stepDetailsVisible, setStepDetailsVisible] = useState<Record<string, boolean>>({});
  const [sousChefMode, setSousChefMode] = useState(false);
  const [sousChefData, setSousChefData] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [stationMode, setStationMode] = useState(false);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [stationOrders, setStationOrders] = useState<any[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getStepKey = (orderId: number, dishId: number) => `${orderId}-${dishId}`;

  const fetchStepCompletions = useCallback(async (orderId: number, dishId: number) => {
    try {
      const data = await api.getStepCompletions(orderId, dishId);
      const key = getStepKey(orderId, dishId);
      setServerStepCompletions(prev => ({ ...prev, [key]: data.map((s: any) => s.stepIndex) }));
      return data.map((s: any) => s.stepIndex);
    } catch { return []; }
  }, []);

  const toggleRecipe = (key: string) => setExpandedRecipes(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleStep = async (orderId: number, dishId: number, stepIdx: number) => {
    const key = getStepKey(orderId, dishId);
    const currentSteps = serverStepCompletions[key] || [];
    const isCompleted = currentSteps.includes(stepIdx);
    const newCompleted = !isCompleted;

    // Optimistic update
    setServerStepCompletions(prev => {
      const steps = prev[key] || [];
      return { ...prev, [key]: newCompleted ? [...steps, stepIdx] : steps.filter(s => s !== stepIdx) };
    });

    try {
      await api.toggleStepCompletion(orderId, dishId, stepIdx, newCompleted);
    } catch {
      // Revert on error
      setServerStepCompletions(prev => {
        const steps = prev[key] || [];
        return { ...prev, [key]: isCompleted ? [...steps, stepIdx] : steps.filter(s => s !== stepIdx) };
      });
      return;
    }

    // Auto-ready if ALL steps for this dish are now completed
    if (newCompleted) {
      const updatedSteps = [...currentSteps, stepIdx];
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const item = order.items?.find((it: any) => it.dishId === dishId || it.dish_id === dishId);
        const tc = item?.techCard;
        const stepsSource = tc?.step_instructions || tc?.technology || '';
        const totalSteps = stepsSource.split('\n').filter((s: string) => s.trim()).length;
        if (totalSteps > 0 && updatedSteps.length >= totalSteps) {
          const itemStatus = order.itemStatuses?.find((s: any) => s.dish_id === dishId);
          if (itemStatus && itemStatus.status === 'preparing') {
            await handleItemStatus(orderId, dishId, 'ready');
          }
        }
      }
    }
  };

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getKitchenOrders();
      setOrders(prev => {
        if (data.length > prev.length && prev.length > 0 && soundEnabled) {
          playBeep();
        }
        return data;
      });
      // Fetch step completions for each dish in each order
      for (const order of data) {
        for (const item of (order.items || [])) {
          const dishId = item.dishId || item.dish_id;
          if (dishId && item.techCard?.step_mode) {
            await fetchStepCompletions(order.id, dishId);
          }
        }
      }
    } catch {}
  }, [soundEnabled, fetchStepCompletions]);

  const loadSousChef = useCallback(async () => {
    try {
      const data = await api.getSousChefRecommendations();
      setSousChefData(data);
    } catch {}
  }, []);

  const loadStations = useCallback(async () => {
    try { setStations(await api.getStations()); } catch {}
  }, []);

  const loadStationOrders = useCallback(async () => {
    try {
      const data = await api.getStationOrders(selectedStation || undefined);
      setStationOrders(data);
    } catch {}
  }, [selectedStation]);

  const isOverdue = (itemStatus: any) => {
    if (!itemStatus?.expected_ready_at) return false;
    return new Date() > new Date(itemStatus.expected_ready_at + 'Z') && itemStatus.status === 'preparing';
  };

  const getRemainingMinutes = (itemStatus: any) => {
    if (!itemStatus?.expected_ready_at) return null;
    const diff = new Date(itemStatus.expected_ready_at + 'Z').getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60000));
  };

  useEffect(() => {
    loadOrders();
    loadStations();
    const interval = setInterval(() => { loadOrders(); if (stationMode) loadStationOrders(); }, 4000);
    return () => clearInterval(interval);
  }, [loadOrders, loadStationOrders, stationMode]);

  useEffect(() => {
    const unsub = api.onEvent('order:new', () => { loadOrders(); });
    const unsub2 = api.onEvent('order:update', () => { loadOrders(); });
    const unsub3 = api.onEvent('order:item:update', () => { loadOrders(); });
    return () => { unsub(); unsub2(); unsub3(); };
  }, [loadOrders]);

  useEffect(() => {
    if (sousChefMode) {
      loadSousChef();
      const interval = setInterval(loadSousChef, 5000);
      return () => clearInterval(interval);
    }
  }, [sousChefMode, loadSousChef]);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const handleAccept = async (orderId: number) => {
    try {
      await api.acceptKitchenOrder(orderId, user.id);
      loadOrders();
    } catch (e: any) { alert(e.message); }
  };

  const handleItemStatus = async (orderId: number, dishId: number, status: string) => {
    try {
      await api.updateItemStatus(orderId, dishId, status, user.id);
      loadOrders();
    } catch (e: any) { alert(e.message); }
  };

  const handleComplete = async (orderId: number) => {
    try {
      await api.completeKitchenOrder(orderId);
      setSelectedOrder(null);
      loadOrders();
    } catch (e: any) { alert(e.message); }
  };

  const handleStationReady = async (orderId: number, itemId: number) => {
    try {
      await api.markStationReady(orderId, itemId);
      loadStationOrders();
      loadOrders();
    } catch (e: any) { alert(e.message); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const getWaitingColor = (minutes: number) => {
    if (minutes > 20) return 'text-red-400 bg-red-500/10';
    if (minutes > 10) return 'text-amber-400 bg-amber-500/10';
    return 'text-zinc-400 bg-zinc-800';
  };

  const getPriorityColor = (score: number) => {
    if (score > 70) return 'text-red-400 bg-red-500/15';
    if (score > 40) return 'text-amber-400 bg-amber-500/15';
    return 'text-green-400 bg-green-500/15';
  };

  // Order detail view
  if (selectedOrder) {
    const order = selectedOrder;
    const itemStatuses = order.itemStatuses || [];
    const allReady = itemStatuses.length > 0 && itemStatuses.every((s: any) => s.status === 'ready' || s.status === 'served');

    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="sticky top-0 z-50 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedOrder(null)} className="p-1 text-zinc-400 hover:text-white"><ChevronRight size={20} className="rotate-180" /></button>
          <h1 className="font-bold text-lg text-white">Заказ #{order.id}</h1>
          <span className="ml-auto text-xs text-zinc-500">{order.tableNumber ? `Стол ${order.tableNumber}` : order.type === 'delivery' ? 'Доставка' : 'Самовынос'}</span>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {/* Timer */}
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-orange-500" />
              <span className="text-sm text-zinc-400">Ожидание:</span>
            </div>
            <span className={`text-lg font-extrabold ${order.waitingTime > 20 ? 'text-red-400' : order.waitingTime > 10 ? 'text-amber-400' : 'text-green-400'}`}>
              {order.waitingTime} мин
            </span>
          </div>

          {/* Order info */}
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-500 mb-3">Состав заказа</h3>
            <div className="space-y-3">
              {order.items?.map((item: any, i: number) => {
                const itemStatus = itemStatuses.find((s: any) => s.dish_id === item.dishId) || { status: item.itemStatus || 'pending' };
                const tc = item.techCard;
                const steps = (tc?.step_instructions || tc?.technology || '').split('\n').filter((s: string) => s.trim());
                const hasSteps = steps.length > 0;
                const itemKey = `${order.id}-${item.dishId}`;
                const showRecipe = expandedRecipes[itemKey] || (tc?.step_mode && showStepsGlobal);
                const stepsDone = serverStepCompletions[itemKey] || [];
                const dishId = item.dishId;
                const ps = item.priority_score || 0;
                const overdue = isOverdue(itemStatus);
                const remaining = getRemainingMinutes(itemStatus);
                return (
                  <div key={i}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        itemStatus.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                        itemStatus.status === 'preparing' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {itemStatus.status === 'ready' ? <Check size={16} /> : item.quantity}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-white">{item.name}</span>
                          <span className="text-xs text-zinc-500">×{item.quantity}</span>
                        </div>
                        <div className="flex gap-1.5 mt-1">
                          {item.options?.map((o: string, j: number) => (
                            <span key={j} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{o}</span>
                          ))}
                          {tc?.cooking_time && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{tc.cooking_time} мин</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getPriorityColor(ps)}`}>
                            {ps}
                          </span>
                        </div>
                        {itemStatus.status === 'preparing' && remaining !== null && (
                          <div className={`flex items-center gap-1 mt-1 ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
                            {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                            <span className="text-[10px]">
                              {overdue ? 'Просрочено' : `Готовность: ${remaining} мин`}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {steps.length > 0 && (
                          <button onClick={() => toggleRecipe(itemKey)} className="text-zinc-500 hover:text-white p-1">
                            {showRecipe ? <ChevronUp size={16} /> : <BookOpen size={16} />}
                          </button>
                        )}
                        {itemStatus.status === 'pending' && (
                          <button onClick={() => handleItemStatus(order.id, item.dishId, 'preparing')}
                            className="bg-amber-500 text-black text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap">Готовить</button>
                        )}
                        {itemStatus.status === 'preparing' && (
                          <button onClick={() => handleItemStatus(order.id, item.dishId, 'ready')}
                            className="bg-green-500 text-black text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap">Готово</button>
                        )}
                        {itemStatus.status === 'ready' && (
                          <span className="text-[10px] font-bold text-green-400 px-2 py-1.5">✓ Готово</span>
                        )}
                      </div>
                    </div>
                    {/* Step progress bar */}
                    {hasSteps && (
                      <div className="ml-11 mb-2 mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${steps.length > 0 ? (stepsDone.length / steps.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-medium">{stepsDone.length}/{steps.length}</span>
                      </div>
                    )}
                    {showRecipe && steps.length > 0 && (
                      <div className="ml-11 mb-3 mt-1 bg-zinc-800/50 rounded-xl p-3 ring-1 ring-zinc-700/50">
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">📖 Рецепт</p>
                        <ol className="space-y-1.5">
                          {steps.map((step: string, si: number) => {
                            const done = stepsDone.includes(si);
                            return (
                              <li key={si} className="flex items-start gap-2">
                                <button onClick={() => toggleStep(order.id, dishId, si)}
                                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                    done ? 'bg-green-500 border-green-500' : 'border-zinc-600 hover:border-zinc-500'
                                  }`}>
                                  {done && <Check size={10} className="text-black" />}
                                </button>
                                <span className={`text-xs leading-tight ${done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{step}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete button */}
          {allReady && (
            <button onClick={() => handleComplete(order.id)}
              className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl text-lg shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
              <Check size={24} /> Заказ готов
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main list view
  const newOrders = orders.filter(o => o.status === 'new');
  const preparingOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing');

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">K</div>
            <div>
              <h1 className="font-bold text-sm">Кухня</h1>
              <p className="text-[10px] text-zinc-500">{user.firstName || user.username}</p>
            </div>
          </div>
            <div className="flex items-center gap-2">
            <button onClick={() => { setSousChefMode(!sousChefMode); if (!sousChefMode) loadSousChef(); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${sousChefMode ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {sousChefMode ? '🧑‍🍳 Шеф-повар' : '🧑‍🍳 Шеф-повар'}
            </button>
            <button onClick={() => setShowStepsGlobal(!showStepsGlobal)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${showStepsGlobal ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {showStepsGlobal ? '📖 Рецепты' : '📖 Скрыть'}
            </button>
            <select
              value={selectedStation || ''}
              onChange={e => { const id = e.target.value ? Number(e.target.value) : null; setSelectedStation(id); setStationMode(!!id); if (id) loadStationOrders(); }}
              className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 outline-none"
            >
              <option value="">Все станции</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${soundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {soundEnabled ? '🔊 Звук' : '🔇 Тишина'}
            </button>
            <button onClick={handleRefresh} className={`p-2 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`}>
              <RefreshCw size={18} />
            </button>
            <button onClick={onLogout} className="text-xs text-zinc-500 hover:text-red-400">Выйти</button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 px-4 py-3 max-w-lg mx-auto">
        <div className="flex-1 bg-blue-500/10 rounded-xl p-2.5 text-center">
          <div className="text-lg font-extrabold text-blue-400">{newOrders.length}</div>
          <div className="text-[10px] text-zinc-500">Новые</div>
        </div>
        <div className="flex-1 bg-amber-500/10 rounded-xl p-2.5 text-center">
          <div className="text-lg font-extrabold text-amber-400">{preparingOrders.length}</div>
          <div className="text-[10px] text-zinc-500">Готовятся</div>
        </div>
        <div className="flex-1 bg-green-500/10 rounded-xl p-2.5 text-center">
          <div className="text-lg font-extrabold text-green-400">{orders.filter(o => o.status === 'ready').length}</div>
          <div className="text-[10px] text-zinc-500">Готово</div>
        </div>
        <div className="flex-1 bg-purple-500/10 rounded-xl p-2.5 text-center">
          <div className="text-lg font-extrabold text-purple-400">{orders.length}</div>
          <div className="text-[10px] text-zinc-500">Всего</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8 space-y-4">
        {/* Station KDS Mode */}
        {stationMode && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                {stations.find(s => s.id === selectedStation)?.name || 'Станция'}
              </h2>
              <button onClick={() => { setStationMode(false); setSelectedStation(null); }} className="text-xs text-zinc-400">Все заказы</button>
            </div>
            {stationOrders.length === 0 && <p className="text-center text-zinc-500 py-10">Нет задач на станции</p>}
            {stationOrders.map((so: any) => {
              const items = JSON.parse(so.items || '[]');
              return (
                <div key={so.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-white">Заказ #{so.orderId}</span>
                      <p className="text-xs text-zinc-500">{so.stationName}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${so.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {so.status === 'ready' ? 'Готово' : 'В работе'}
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-zinc-300">{item.name}</span>
                        <span className="text-zinc-500">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {so.status !== 'ready' && (
                    <button onClick={() => handleStationReady(so.orderId, so.id)} className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                      <Check size={18} /> Готово
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!stationMode && (
        <>
        {/* New Orders */}
        {newOrders.map(order => (
          <div key={order.id} className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-blue-400 animate-pulse" />
                <span className="font-bold text-white">Заказ #{order.id}</span>
              </div>
              <span className="text-xs text-blue-400 font-semibold">{order.tableNumber ? `Стол ${order.tableNumber}` : order.type}</span>
            </div>
            <div className="space-y-1.5 mb-3">
              {order.items?.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-zinc-300">{item.name}</span>
                  <span className="text-zinc-500">×{item.quantity}</span>
                </div>
              ))}
              {order.items?.length > 5 && <p className="text-xs text-zinc-500">+ ещё {order.items.length - 5}</p>}
            </div>
            <button onClick={() => handleAccept(order.id)}
              className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <ChefHat size={16} /> Принять
            </button>
          </div>
        ))}

        {/* Sous Chef Panel */}
        {sousChefMode && sousChefData.length > 0 && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-purple-400" />
              <span className="font-bold text-sm text-purple-400">Рекомендации шеф-повара</span>
            </div>
            <div className="space-y-2">
              {sousChefData.slice(0, 5).map((rec: any) => (
                <div key={rec.order_id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
                  <div>
                    <span className="text-xs font-semibold text-white">Заказ #{rec.order_id}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{rec.guest} · {rec.items_count} бл.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(rec.priority_score)}`}>
                      {rec.priority_score}
                    </span>
                    <span className={`text-[10px] font-semibold ${rec.suggested_action === 'START_NOW' ? 'text-red-400' : rec.suggested_action === 'SOON' ? 'text-amber-400' : 'text-green-400'}`}>
                      {rec.suggested_action === 'START_NOW' ? 'Срочно!' : rec.suggested_action === 'SOON' ? 'Скоро' : 'В срок'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preparing Orders */}
        {(sousChefMode ? [...preparingOrders].sort((a, b) => {
          const aMax = Math.max(...(a.items || []).map((i: any) => i.priority_score || 0));
          const bMax = Math.max(...(b.items || []).map((i: any) => i.priority_score || 0));
          return bMax - aMax;
        }) : preparingOrders).map(order => (
          <div key={order.id} onClick={() => setSelectedOrder(order)}
            className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 cursor-pointer active:scale-[0.99] transition-transform">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Заказ #{order.id}</span>
                {order.tableNumber && <span className="text-xs text-zinc-500">Стол {order.tableNumber}</span>}
              </div>
              <div className="flex items-center gap-2">
                {sousChefMode && (() => {
                  const maxPs = Math.max(...(order.items || []).map((i: any) => i.priority_score || 0));
                  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityColor(maxPs)}`}>{maxPs}</span>;
                })()}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getWaitingColor(order.waitingTime)}`}>
                  {order.waitingTime} мин
                </span>
                <ChevronRight size={16} className="text-zinc-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              {order.items?.map((item: any, i: number) => {
                const isReady = order.itemStatuses?.find((s: any) => s.dish_id === item.dishId)?.status === 'ready';
                const ps = item.priority_score || 0;
                return (
                  <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                    isReady ? 'bg-green-500/20 text-green-400 line-through' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {sousChefMode && !isReady && <span className={`w-1.5 h-1.5 rounded-full ${ps > 70 ? 'bg-red-400' : ps > 40 ? 'bg-amber-400' : 'bg-green-400'}`} />}
                    {item.name}
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-16">
            <ChefHat size={56} className="text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 font-semibold text-lg">Нет заказов</p>
            <p className="text-xs text-zinc-600 mt-1">Ожидайте поступления новых заказов</p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
