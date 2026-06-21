import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Package, RefreshCw, Edit3, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function ForecastPage() {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadForecasts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (filterProduct) params.product_id = Number(filterProduct);
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const data = await api.getForecast(params);
      setForecasts(data);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки прогнозов');
    }
    finally { setLoading(false); }
  }, [filterProduct, fromDate, toDate]);

  useEffect(() => { loadForecasts(); }, [loadForecasts]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await api.generateForecast();
      const count = Array.isArray(result) ? result.length : 0;
      setSuccessMsg(`Прогноз сформирован: ${count} записей`);
      await loadForecasts();
    } catch (e: any) {
      setError(e.message || 'Ошибка при формировании прогноза');
    }
    finally { setGenerating(false); }
  };

  const toggleExpand = async (productId: number) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setHistoryData([]);
      return;
    }
    setExpandedProduct(productId);
    try {
      const data = await api.getForecastHistory(productId, 30);
      setHistoryData(data);
    } catch { setHistoryData([]); }
  };

  const handleAdjust = async (forecastId: number) => {
    if (editingId === forecastId) {
      const qty = parseFloat(editValue);
      if (isNaN(qty)) return;
      try {
        await api.adjustForecast(forecastId, qty);
        setEditingId(null);
        await loadForecasts();
      } catch (e) { console.error(e); }
    } else {
      const row = forecasts.find(f => f.id === forecastId);
      setEditValue(String(row?.forecastQuantity ?? 0));
      setEditingId(forecastId);
    }
  };

  const handleCreateOrder = async (productId: number, productName: string, qty: number) => {
    try {
      await api.createDocument({
        type: 'contractor_order',
        items: JSON.stringify([{ item_id: productId, item_name: productName, quantity: qty }]),
        date: new Date().toISOString(),
      });addToast('Черновик заказа контрагенту создан', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const groupedByProduct = forecasts.reduce((acc: any, f: any) => {
    if (!acc[f.productId]) {
      acc[f.productId] = { productId: f.productId, productName: f.productName, unit: f.unit, currentStock: f.currentStock, minStock: f.minStock, days: [] };
    }
    acc[f.productId].days.push(f);
    return acc;
  }, {} as Record<number, any>);

  const products = Object.values(groupedByProduct) as any[];
  const totalItems = products.length;
  const totalRecommended = products.reduce((sum: number, p: any) => {
    const maxRec = Math.max(...p.days.map((d: any) => d.recommendedPurchase || 0));
    return sum + maxRec;
  }, 0);

  const maxHistoryQty = historyData.length > 0 ? Math.max(...historyData.map(d => d.quantity || 0), 1) : 1;
  const maxForecastQty = expandedProduct && products.find((p: any) => p.productId === expandedProduct)?.days
    ? Math.max(...products.find((p: any) => p.productId === expandedProduct).days.map((d: any) => d.forecastQuantity || 0), 1)
    : 1;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <BarChart3 size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Прогноз спроса</h1>
              <p className="text-sm text-zinc-500">Прогнозирование расхода ингредиентов на основе истории</p>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 active:scale-[0.97]">
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Формирование...' : 'Сформировать прогноз'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">{error}</div>
        )}
        {successMsg && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400 mb-4">{successMsg}</div>
        )}
        <div className="flex gap-3 mb-6">
          <input placeholder="ID продукта" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 w-32" />
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
          <button onClick={loadForecasts} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition active:scale-[0.97]">Применить</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">Всего продуктов</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{totalItems}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wider">Рекомендовано к закупке</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{totalRecommended.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">Прогноз на 7 дней</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{forecasts.length}</p>
          </div>
        </div>

        {loading ? <div className="text-center py-12 text-zinc-400">Загрузка...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Продукт</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Текущий остаток</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Прогноз на неделю</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Мин. остаток</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Рекомендовано к закупке</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Ед. изм.</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => {
                  const totalForecast = product.days.reduce((s: number, d: any) => s + (d.forecastQuantity || 0), 0);
                  const maxRec = Math.max(...product.days.map((d: any) => d.recommendedPurchase || 0));
                  const isExpanded = expandedProduct === product.productId;
                  return (
                    <>
                      <tr key={product.productId}
                        onClick={() => toggleExpand(product.productId)}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                        <td className="px-3 py-3 text-zinc-900 dark:text-white font-medium flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {product.productName || `ID ${product.productId}`}
                        </td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{product.currentStock ?? 0}</td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{totalForecast.toFixed(2)}</td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">{product.minStock ?? 0}</td>
                        <td className="px-3 py-3 text-green-600 font-semibold">{maxRec.toFixed(2)}</td>
                        <td className="px-3 py-3 text-zinc-500">{product.unit || 'шт'}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleCreateOrder(product.productId, product.productName || '', totalForecast); }}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Сформировать заказ">
                              <ShoppingCart size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${product.productId}-detail`}>
                          <td colSpan={7} className="px-3 py-4 bg-zinc-50 dark:bg-zinc-800/30">
                            <div className="mb-4">
                              <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Ежедневная разбивка</p>
                              <div className="grid grid-cols-7 gap-2">
                                {product.days.map((d: any) => (
                                  <div key={d.id} className="bg-white dark:bg-zinc-800 rounded-lg p-2 text-center border border-zinc-200 dark:border-zinc-700">
                                    <p className="text-[10px] text-zinc-400">{d.forecastDate?.split('-').slice(1).join('.')}</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{d.forecastQuantity ?? 0}</p>
                                    <p className="text-[10px] text-zinc-400">прогноз</p>
                                    {editingId === d.id ? (
                                      <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                        <input type="number" step="0.01" value={editValue} onChange={e => setEditValue(e.target.value)}
                                          className="w-16 border border-blue-300 rounded px-1 py-0.5 text-xs text-center" />
                                        <button onClick={() => handleAdjust(d.id)} className="text-green-600 text-xs font-bold">✓</button>
                                        <button onClick={() => setEditingId(null)} className="text-red-500 text-xs">✕</button>
                                      </div>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setEditingId(d.id); setEditValue(String(d.forecastQuantity ?? 0)); }}
                                        className="mt-1 text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1 mx-auto">
                                        <Edit3 size={10} /> Скорректировать
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {historyData.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">История расхода (30 дней) vs Прогноз</p>
                                <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                                  {historyData.map((h: any, idx: number) => {
                                    const hPct = Math.max(3, (h.quantity || 0) / maxHistoryQty * 100);
                                    const forecastForDate = product.days.find((d: any) => d.forecastDate === h.date);
                                    const fPct = forecastForDate ? Math.max(3, (forecastForDate.forecastQuantity || 0) / maxHistoryQty * 100) : 0;
                                    return (
                                      <div key={idx} className="flex flex-col items-center gap-0.5 flex-shrink-0" title={`${h.date}: факт ${h.quantity || 0}`}>
                                        <div style={{ height: `${hPct}%` }} className="w-4 bg-green-400 dark:bg-green-500 rounded-t" />
                                        {forecastForDate && <div style={{ height: `${fPct}%` }} className="w-1.5 bg-blue-400 dark:bg-blue-500 rounded-t" />}
                                        <span className="text-[8px] text-zinc-400 mt-1">{h.date?.slice(5, 10)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Факт</span>
                                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Прогноз</span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {products.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-zinc-400">Нет данных прогноза. Нажмите «Сформировать прогноз»</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
