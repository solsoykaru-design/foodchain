import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Save, X, FileText, Plus, Trash2, Download, RefreshCw, Copy, Link, Edit3, Eye } from 'lucide-react';
import * as api from '../api';
import CreateTechCardModal from './CreateTechCardModal';
import TechCardViewModal from './TechCardViewModal';
import { addToast } from '../ToastContext';

const UNIT_OPTIONS = ['кг', 'г', 'л', 'мл', 'шт'];
const TAX_OPTIONS = ['Без НДС', '10%', '18%', '20%'];
const DOC_TYPES = ['Все', 'Приход', 'Возврат', 'Списание', 'Перемещение', 'Инвентаризация', 'Акт реализ.', 'Производство', 'Разбор', 'Переработка', 'Отгрузка', 'ЕГАИС'];

interface Props {
  itemId: number;
  allIds: number[];
  onClose: () => void;
  onSaved: () => void;
}

export default function StockItemCard({ itemId, allIds, onClose, onSaved }: Props) {
  const [currentIndex, setCurrentIndex] = useState(allIds.indexOf(itemId));
  const [item, setItem] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);

  const unit = UNIT_OPTIONS;

  // General fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('шт');
  const [brutto, setBrutto] = useState('');
  const [netto, setNetto] = useState('');
  const [coldLoss, setColdLoss] = useState('');
  const [weightByTechCard, setWeightByTechCard] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [article, setArticle] = useState('');
  const [gtin, setGtin] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [withVat, setWithVat] = useState(false);
  const [taxRate, setTaxRate] = useState('Без НДС');
  const [currentCost, setCurrentCost] = useState('');
  const [lastPrice, setLastPrice] = useState('');
  const [kcal, setKcal] = useState('');
  const [proteins, setProteins] = useState('');
  const [fats, setFats] = useState('');
  const [carbs, setCarbs] = useState('');
  const [caloriesByTechCard, setCaloriesByTechCard] = useState(false);
  const [heatTreatment, setHeatTreatment] = useState(false);
  const [isReturnable, setIsReturnable] = useState(false);
  const [isMain, setIsMain] = useState(false);
  const [excludeNeg, setExcludeNeg] = useState(false);
  const [beerType, setBeerType] = useState(false);
  const [alcoholType, setAlcoholType] = useState(false);
  const [tobaccoType, setTobaccoType] = useState(false);
  const [sugarType, setSugarType] = useState(false);
  const [id1c, setId1c] = useState('');

  // Tech cards
  const [techCards, setTechCards] = useState<any[]>([]);
  const [techCardsAsIng, setTechCardsAsIng] = useState<any[]>([]);
  const [tcStore, setTcStore] = useState('');
  const [tcCurrentOnly, setTcCurrentOnly] = useState(false);
  const [tcPage, setTcPage] = useState(1);
  const [tcTotal, setTcTotal] = useState(0);
  const [tcTotalPages, setTcTotalPages] = useState(1);
  const [selectedTcIds, setSelectedTcIds] = useState<Set<number>>(new Set());

  // Tech card creation modal
  const [showCreateTcModal, setShowCreateTcModal] = useState(false);
  const [viewingTcId, setViewingTcId] = useState<number | null>(null);

  // Breakdown tech cards
  const [breakdownCards, setBreakdownCards] = useState<any[]>([]);
  const [bdStore, setBdStore] = useState('');
  const [bdCurrentOnly, setBdCurrentOnly] = useState(false);
  const [selectedBdIds, setSelectedBdIds] = useState<Set<number>>(new Set());

  // Packaging
  const [packagings, setPackagings] = useState<any[]>([]);

  // Composition
  const [compositions, setCompositions] = useState<any[]>([]);
  const [hideArchived, setHideArchived] = useState(false);

  // Batches
  const [batches, setBatches] = useState<any[]>([]);
  const [batchWarehouse, setBatchWarehouse] = useState('');

  // Contragents
  const [stockContragents, setStockContragents] = useState<any[]>([]);

  // History
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [histWarehouse, setHistWarehouse] = useState('');
  const [histDocType, setHistDocType] = useState('Все');
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);

  // Warehouse bindings
  const [bindings, setBindings] = useState<any[]>([]);
  const [onlyBound, setOnlyBound] = useState(false);
  const [whSearch, setWhSearch] = useState('');

  const currentId = allIds[currentIndex];

  const loadItem = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStockItem(currentId);
      setItem(data);
      setName(data.name || '');
      setCategory(data.category || '');
      setSelectedUnit(data.unit || 'шт');
      setBrutto(String(data.brutto ?? ''));
      setNetto(String(data.netto ?? ''));
      setColdLoss(String(data.coldLossPercent ?? ''));
      setWeightByTechCard(!!data.weightByTechCard);
      setBarcode(data.barcode || '');
      setArticle(data.article || '');
      setGtin(data.gtin || '');
      setBasePrice(String(data.basePrice ?? ''));
      setWithVat(!!data.withVat);
      setTaxRate(data.taxRate || 'Без НДС');
      setCurrentCost(String(data.currentCost ?? ''));
      setLastPrice(String(data.lastPrice ?? ''));
      setKcal(String(data.kcal ?? ''));
      setProteins(String(data.proteins ?? ''));
      setFats(String(data.fats ?? ''));
      setCarbs(String(data.carbs ?? ''));
      setCaloriesByTechCard(!!data.caloriesByTechCard);
      setHeatTreatment(!!data.heatTreatment);
      setIsReturnable(!!data.isReturnable);
      setIsMain(!!data.isMain);
      setExcludeNeg(!!data.excludeNegControl);
      setBeerType(!!data.beerType);
      setAlcoholType(!!data.alcoholType);
      setTobaccoType(!!data.tobaccoType);
      setSugarType(!!data.sugarType);
      setId1c(data.id1c || '');

      // Load lookups
      try { const c = await api.getStockCategories(); setCategories(c.map((x: any) => x.name).filter(Boolean)); } catch {}
      try { const w = await api.getSuppliers(); setWarehouses(w.map((x: any) => x.name).filter(Boolean)); } catch {}
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [currentId]);

  useEffect(() => { loadItem(); }, [loadItem]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateStockItem(currentId, {
        name, category, unit: selectedUnit,
        brutto: parseFloat(brutto) || 0, netto: parseFloat(netto) || 0,
        cold_loss_percent: parseFloat(coldLoss) || 0,
        weight_by_tech_card: weightByTechCard,
        barcode, article, gtin,
        base_price: parseFloat(basePrice) || 0,
        with_vat: withVat, tax_rate: taxRate,
        kcal: parseFloat(kcal) || 0, proteins: parseFloat(proteins) || 0,
        fats: parseFloat(fats) || 0, carbs: parseFloat(carbs) || 0,
        calories_by_tech_card: caloriesByTechCard, heat_treatment: heatTreatment,
        is_returnable: isReturnable, is_main: isMain, exclude_neg_control: excludeNeg,
        beer_type: beerType, alcohol_type: alcoholType,
        tobacco_type: tobaccoType, sugar_type: sugarType,
        id_1c: id1c,
      });
      onSaved();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const navigate = (dir: number) => {
    const idx = currentIndex + dir;
    if (idx < 0 || idx >= allIds.length) return;
    setCurrentIndex(idx);
    setTab(0);
  };

  const clearSpecial = () => {
    setBeerType(false); setAlcoholType(false); setTobaccoType(false); setSugarType(false);
  };

  // Tab data loading
  useEffect(() => {
    if (tab === 1) { loadTechCards(); }
    else if (tab === 2) { loadBreakdownCards(); }
    else if (tab === 3) { loadPackagings(); }
    else if (tab === 4) { loadComposition(); }
    else if (tab === 5) { loadBatches(); }
    else if (tab === 6) { loadContragents(); }
    else if (tab === 7) { loadHistory(); }
    else if (tab === 8) { loadBindings(); }
  }, [tab, currentId]);

  const loadTechCards = async () => {
    try {
      const [r, ingR] = await Promise.all([
        api.getStockItemTechCards(currentId, { store: tcStore, current_only: tcCurrentOnly ? true : undefined, page: tcPage }),
        api.getStockItemTechCardsAsIngredient(currentId),
      ]);
      setTechCards(r.items || []);
      setTechCardsAsIng(ingR.items || []);
      setTcTotal(r.total || 0);
      setTcTotalPages(Math.max(1, Math.ceil((r.total || 0) / (r.limit || 20))));
    } catch {}
  };

  const handleCopyTechCard = async () => {
    const ids = [...selectedTcIds];
    if (ids.length === 0) { addToast('Выберите техкарту для копирования', 'warning'); return; }
    try {
      for (const id of ids) { await api.copyTechCard(id); }
      setSelectedTcIds(new Set());
      loadTechCards();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDeleteTechCard = async (isBreakdown = false) => {
    const ids = isBreakdown ? [...selectedBdIds] : [...selectedTcIds];
    if (ids.length === 0) { addToast('Выберите техкарты для удаления', 'warning'); return; }
    if (!confirm(`Удалить ${ids.length} техкарт(у)?`)) return;
    try {
      for (const id of ids) {
        if (isBreakdown) {
          await api.deleteStockTechCard(id);
        } else {
          await api.deleteStockTechCard(id);
        }
      }
      setSelectedTcIds(new Set());
      setSelectedBdIds(new Set());
      if (isBreakdown) loadBreakdownCards(); else loadTechCards();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const toggleTcSelect = (id: number) => {
    setSelectedTcIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBdSelect = (id: number) => {
    setSelectedBdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadBreakdownCards = async () => {
    try { const r = await api.getStockItemBreakdownTechCards(currentId, { store: bdStore, current_only: bdCurrentOnly ? true : undefined }); setBreakdownCards(r.items || []); } catch {}
  };
  const loadPackagings = async () => {
    try { const r = await api.getStockItemPackagings(currentId); setPackagings(r || []); } catch {}
  };
  const loadComposition = async () => {
    try { const r = await api.getStockItemComposition(currentId, hideArchived); setCompositions(r || []); } catch {}
  };
  const loadBatches = async () => {
    try { const r = await api.getStockItemBatches(currentId, { warehouse: batchWarehouse }); setBatches(r.items || []); } catch {}
  };
  const loadContragents = async () => {
    try { const r = await api.getStockItemContragents(currentId); setStockContragents(r || []); } catch {}
  };
  const loadHistory = async () => {
    try {
      const dt = histDocType === 'Все' ? undefined : histDocType;
      const r = await api.getStockItemHistory(currentId, { warehouse: histWarehouse, doc_type: dt, date_from: histDateFrom || undefined, date_to: histDateTo || undefined, page: histPage });
      setHistoryItems(r.items || []); setHistTotalPages(Math.max(1, Math.ceil((r.total || 0) / (r.limit || 20))));
    } catch {}
  };
  const loadBindings = async () => {
    try { const r = await api.getStockItemWarehouseBindings(currentId, { only_bound: onlyBound, search: whSearch }); setBindings(r || []); } catch {}
  };

  const dateQuick = (preset: string) => {
    const now = new Date();
    if (preset === 'today') { setHistDateFrom(now.toISOString().slice(0,10)); setHistDateTo(now.toISOString().slice(0,10)); }
    else if (preset === 'yesterday') { const d = new Date(now); d.setDate(d.getDate()-1); setHistDateFrom(d.toISOString().slice(0,10)); setHistDateTo(d.toISOString().slice(0,10)); }
    else if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1); setHistDateFrom(d.toISOString().slice(0,10)); setHistDateTo(now.toISOString().slice(0,10)); }
    else if (preset === 'month') { setHistDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)); setHistDateTo(now.toISOString().slice(0,10)); }
  };

  const tabs = [
    { label: 'Общие настройки' },
    { label: 'Тех. карта' },
    { label: 'Тех. карта разбора' },
    { label: 'Фасовка' },
    { label: 'В составе' },
    { label: 'Партии' },
    { label: 'Контрагенты' },
    { label: 'История' },
    { label: 'Склады' },
  ];

  if (!item) return <div className="p-8 text-center text-zinc-500">Загрузка...</div>;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex-1">{name || 'Карточка товара'}</h2>
        <span className="text-xs text-zinc-400">{item.createdAt ? `Создан: ${new Date(item.createdAt).toLocaleDateString('ru-RU')}` : ''}</span>
        <button onClick={() => navigate(-1)} disabled={currentIndex === 0} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => navigate(1)} disabled={currentIndex >= allIds.length - 1} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          <Save size={16} /> {saving ? 'Сохранение...' : 'Обновить'}
        </button>
        <button onClick={onClose} className="flex items-center gap-1.5 bg-zinc-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-zinc-500">
          <X size={16} /> Отмена
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 px-4 overflow-x-auto">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === i ? 'border-blue-500 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
        {loading ? <div className="text-center py-12 text-zinc-400">Загрузка...</div> : (
          <>
            {tab === 0 && (
              <div className="space-y-6">
                {/* Основное */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Основное</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Название</label>
                      <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" required />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Категория</label>
                      <input list="cat-list" value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                      <datalist id="cat-list">{categories.map((c, i) => <option key={i} value={c} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Ед. изм. элемента</label>
                      <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800">
                        {unit.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Брутто, кг</label>
                      <input value={brutto} onChange={e => setBrutto(e.target.value)} disabled={weightByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Нетто, кг</label>
                      <input value={netto} onChange={e => setNetto(e.target.value)} disabled={weightByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Потери при холодной обработке, %</label>
                      <input value={coldLoss} onChange={e => setColdLoss(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={withVat} onChange={e => setWithVat(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">с НДС</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isMain} onChange={e => setIsMain(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Главный</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Штрихкод базовой ед. изм.</label>
                      <input value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, '').slice(0,14))} maxLength={14} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Артикул</label>
                      <input value={article} onChange={e => setArticle(e.target.value.slice(0,50))} maxLength={50} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Код GTIN</label>
                      <input value={gtin} onChange={e => setGtin(e.target.value.replace(/\D/g, '').slice(0,14))} maxLength={14} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                    </div>
                  </div>
                </div>

                {/* Цена и налог */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Цена и налог</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Базовая цена</label>
                      <input value={basePrice} onChange={e => setBasePrice(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={withVat} onChange={e => setWithVat(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">с НДС</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Налог</label>
                      <select value={taxRate} onChange={e => setTaxRate(e.target.value)} disabled={!withVat} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50">
                        {TAX_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Текущая себестоимость</label>
                      <div className="text-sm text-zinc-800 dark:text-zinc-200 pt-1.5">{currentCost}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Последняя цена</label>
                      <div className="text-sm text-zinc-800 dark:text-zinc-200 pt-1.5">{lastPrice}</div>
                    </div>
                  </div>
                </div>

                {/* КБЖУ */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Пищевая и энергетическая ценность</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Ккал (на 100г)</label>
                      <input value={kcal} onChange={e => setKcal(e.target.value)} disabled={caloriesByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Белки</label>
                      <input value={proteins} onChange={e => setProteins(e.target.value)} disabled={caloriesByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Жиры</label>
                      <input value={fats} onChange={e => setFats(e.target.value)} disabled={caloriesByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Углеводы</label>
                      <input value={carbs} onChange={e => setCarbs(e.target.value)} disabled={caloriesByTechCard} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 disabled:opacity-50" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={caloriesByTechCard} onChange={e => setCaloriesByTechCard(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Калории по тех. карте</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={heatTreatment} onChange={e => setHeatTreatment(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Тепловая обработка</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Опции */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Опции</h3>
                  <div className="flex items-center gap-6 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isReturnable} onChange={e => setIsReturnable(e.target.checked)} className="rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Возвратный</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={excludeNeg} onChange={e => setExcludeNeg(e.target.checked)} className="rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Исключить из контроля отрицательных остатков</span>
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">Специальные типы (взаимоисключающие):</p>
                  <div className="flex items-center gap-4">
                    {[
                      { label: 'Пиво и пивные напитки', key: 'beer', val: beerType, set: (v: boolean) => { clearSpecial(); setBeerType(v); } },
                      { label: 'Крепкий Алкоголь', key: 'alcohol', val: alcoholType, set: (v: boolean) => { clearSpecial(); setAlcoholType(v); } },
                      { label: 'Табачный продукт', key: 'tobacco', val: tobaccoType, set: (v: boolean) => { clearSpecial(); setTobaccoType(v); } },
                      { label: 'Сахаросодержащий напиток', key: 'sugar', val: sugarType, set: (v: boolean) => { clearSpecial(); setSugarType(v); } },
                    ].map(({ label, val, set }) => (
                      <label key={label} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="rounded" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Интеграции */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Интеграции</h3>
                  <div className="max-w-xs">
                    <label className="block text-xs text-zinc-500 mb-1">Идентификатор 1C</label>
                    <input value={id1c} onChange={e => setId1c(e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            )}

            {tab === 1 && (
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={loadTechCards} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><RefreshCw size={14} /> Обновить</button>
                  <button onClick={() => setShowCreateTcModal(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><Plus size={14} /> Создать тех. карту</button>
                  <button onClick={handleCopyTechCard} className="flex items-center gap-1 bg-zinc-500 text-white px-3 py-1.5 rounded-lg text-sm"><Copy size={14} /> Копировать</button>
                  <button onClick={() => handleDeleteTechCard(false)} className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm"><Trash2 size={14} /> Удалить</button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Магазин:</span>
                    <input list="wh-list" value={tcStore} onChange={e => setTcStore(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm w-40" />
                    <datalist id="wh-list">{warehouses.map((w, i) => <option key={i} value={w} />)}</datalist>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={tcCurrentOnly} onChange={e => setTcCurrentOnly(e.target.checked)} />
                      Только текущие
                    </label>
                  </div>
                </div>

                {/* Tech cards where product is main item */}
                <h4 className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Техкарты (основной элемент)</h4>
                <Table columns={['', 'Номер', 'Выход, кг', 'Себестоимость', 'Создана', 'Действительна с', 'Тип', 'Магазин', '']}
                  data={techCards.map(c => [
                    <input type="checkbox" className="rounded" checked={selectedTcIds.has(c.id)} onChange={() => toggleTcSelect(c.id)} />,
                    <button className="text-blue-600 hover:underline text-left" onClick={() => setViewingTcId(c.id)}>{c.number}</button>,
                    c.totalYield != null ? Number(c.totalYield).toFixed(3) : c.output,
                    c.totalCost != null ? Number(c.totalCost).toFixed(2) : c.costPrice,
                    c.createdAt?.slice(0, 10), c.validFrom?.slice(0, 10), c.type, c.store,
                    <button className="text-blue-500"><Download size={14} /></button>
                  ])} />
                <Pagination page={tcPage} totalPages={tcTotalPages} onPage={p => { setTcPage(p); loadTechCards(); }} />

                {/* Tech cards where product is used as ingredient */}
                <h4 className="text-xs font-semibold text-zinc-500 mt-6 mb-2 uppercase tracking-wider">Техкарты (в составе как ингредиент)</h4>
                {techCardsAsIng.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4">Не используется как ингредиент в других техкартах</p>
                ) : (
                  <Table columns={['Номер', 'Название', 'Выход, кг', 'Себестоимость', 'Тип', 'Магазин']}
                    data={techCardsAsIng.map(c => [
                      <button className="text-blue-600 hover:underline text-left" onClick={() => setViewingTcId(c.id)}>{c.number}</button>,
                      c.name,
                      c.totalYield != null ? Number(c.totalYield).toFixed(3) : c.output,
                      c.totalCost != null ? Number(c.totalCost).toFixed(2) : c.costPrice,
                      c.type, c.store,
                    ])} />
                )}
              </div>
            )}

            {tab === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={loadBreakdownCards} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><RefreshCw size={14} /> Обновить</button>
                  <button onClick={() => setShowCreateTcModal(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><Plus size={14} /> Создать тех. карту разбора</button>
                  <button onClick={() => handleDeleteTechCard(true)} className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm"><Trash2 size={14} /> Удалить</button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Магазин:</span>
                    <input list="wh-list2" value={bdStore} onChange={e => setBdStore(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm w-40" />
                    <datalist id="wh-list2">{warehouses.map((w, i) => <option key={i} value={w} />)}</datalist>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={bdCurrentOnly} onChange={e => setBdCurrentOnly(e.target.checked)} />
                      Только текущие
                    </label>
                  </div>
                </div>
                <Table columns={['', 'Номер', 'Выход', 'Себестоимость', 'Создана', 'Действительна с', 'Тип', 'Магазин']}
                  data={breakdownCards.map(c => [
                    <input type="checkbox" className="rounded" checked={selectedBdIds.has(c.id)} onChange={() => toggleBdSelect(c.id)} />,
                    c.number, c.output, c.costPrice, c.createdAt?.slice(0,10), c.validFrom?.slice(0,10), c.type, c.store
                  ])} />
              </div>
            )}

            {tab === 3 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={async () => { const n = prompt('Название фасовки:'); if (n) { await api.addStockItemPackaging(currentId, { name: n, barcode: '', isPrimary: packagings.length === 0, size: 1 }); loadPackagings(); }}} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><Plus size={14} /> Добавить</button>
                  <button onClick={async () => { const sel = packagings.find(p => (p as any)._selected); if (sel && confirm('Удалить?')) { await api.deleteStockItemPackaging(currentId, sel.id); loadPackagings(); }}} className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm"><Trash2 size={14} /> Удалить</button>
                </div>
                <Table columns={['Название', 'Штрихкод', 'Основная', 'Размер']}
                  data={packagings.map(p => [
                    <input value={p.name} onChange={e => { p.name = e.target.value; api.updateStockItemPackaging(currentId, p.id, { name: p.name }); }} className="w-full border-0 bg-transparent text-sm" />,
                    <input value={p.barcode} onChange={e => { p.barcode = e.target.value; api.updateStockItemPackaging(currentId, p.id, { barcode: p.barcode }); }} className="w-full border-0 bg-transparent text-sm" />,
                    <input type="checkbox" checked={p.isPrimary} onChange={e => { p.isPrimary = e.target.checked; api.updateStockItemPackaging(currentId, p.id, { isPrimary: p.isPrimary }); }} className="rounded" />,
                    <input value={p.size} onChange={e => { p.size = parseFloat(e.target.value) || 0; api.updateStockItemPackaging(currentId, p.id, { size: p.size }); }} className="w-full border-0 bg-transparent text-sm" />,
                  ])} />
              </div>
            )}

            {tab === 4 && (
              <div>
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hideArchived} onChange={e => { setHideArchived(e.target.checked); loadComposition(); }} className="rounded" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Скрыть архивные</span>
                  </label>
                </div>
                <Table columns={['Название', 'Количество (Брутто)', 'Тип']}
                  data={compositions.map(c => [c.name, c.brutto, c.type])} />
              </div>
            )}

            {tab === 5 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-zinc-500">Склад:</span>
                  <input list="wh-list3" value={batchWarehouse} onChange={e => { setBatchWarehouse(e.target.value); }} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm w-40" />
                  <datalist id="wh-list3">{warehouses.map((w, i) => <option key={i} value={w} />)}</datalist>
                  <button onClick={loadBatches} className="text-xs text-blue-500 hover:underline">Обновить</button>
                </div>
                <Table columns={['Дата поступления', 'Документ', 'Срок годности', 'Контрагент', 'Склад', 'Стоимость']}
                  data={batches.map(b => [b.arrivalDate?.slice(0,10), b.document, b.expiryDate?.slice(0,10), b.contragent, b.warehouse, b.cost])} />
              </div>
            )}

            {tab === 6 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={async () => { const n = prompt('Имя контрагента:'); if (n) { await api.addStockItemContragent(currentId, { name: n }); loadContragents(); }}} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><Plus size={14} /> Добавить</button>
                  <button className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm"><Trash2 size={14} /> Удалить</button>
                </div>
                <Table columns={['Контрагент', 'Дата последнего прихода', 'Цена последнего прихода', 'Согласованная Цена', 'Фасовка']}
                  data={stockContragents.map(c => [c.contragentName || c.name, c.lastArrivalDate?.slice(0,10), c.lastArrivalPrice, c.agreedPrice, c.packaging])} />
              </div>
            )}

            {tab === 7 && (
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs text-zinc-500">Склад:</span>
                  <input value={histWarehouse} onChange={e => setHistWarehouse(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm w-36" />
                  <span className="text-xs text-zinc-500">Тип документа:</span>
                  <select value={histDocType} onChange={e => setHistDocType(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm">
                    {DOC_TYPES.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <span className="text-xs text-zinc-500">С:</span>
                  <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm" />
                  <span className="text-xs text-zinc-500">По:</span>
                  <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm" />
                  <button onClick={() => dateQuick('today')} className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">Сегодня</button>
                  <button onClick={() => dateQuick('yesterday')} className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">Вчера</button>
                  <button onClick={() => dateQuick('week')} className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">Эта неделя</button>
                  <button onClick={() => dateQuick('month')} className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">Этот месяц</button>
                  <button onClick={loadHistory} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Download size={12} /> XLSX</button>
                </div>
                <Table columns={['Дата', 'Документ', 'Склад', 'Изменение', 'Цена', 'Кол-во документальное']}
                  data={historyItems.map(h => [h.date?.slice(0,10), h.document, h.warehouse, h.change, h.price, h.docQuantity])} />
                <Pagination page={histPage} totalPages={histTotalPages} onPage={p => { setHistPage(p); loadHistory(); }} />
              </div>
            )}

            {tab === 8 && (
              <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={async () => { await api.bindStockItemToAllWarehouses(currentId); loadBindings(); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm"><Link size={14} /> Привязать ко всем складам</button>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={onlyBound} onChange={e => { setOnlyBound(e.target.checked); loadBindings(); }} className="rounded" />
                    Только привязанные к складу
                  </label>
                  <span className="text-xs text-zinc-500">Поиск:</span>
                  <input value={whSearch} onChange={e => { setWhSearch(e.target.value); }} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm w-40" />
                  <button onClick={loadBindings} className="text-xs text-blue-500 hover:underline">Обновить</button>
                </div>
                <Table columns={['Склад', 'Привязка к складу', 'Мин. Кол-во', 'Макс. Кол-во']}
                  data={bindings.map(b => [
                    b.warehouseName,
                    <input type="checkbox" checked={b.isBound} onChange={e => { b.isBound = e.target.checked; api.updateStockItemWarehouseBinding(currentId, b.id, { is_bound: b.isBound }); }} className="rounded" />,
                    <input value={b.minQty} onChange={e => { b.minQty = parseFloat(e.target.value) || 0; api.updateStockItemWarehouseBinding(currentId, b.id, { min_qty: b.minQty }); }} className="w-16 border-0 bg-transparent text-sm text-center" />,
                    <input value={b.maxQty} onChange={e => { b.maxQty = parseFloat(e.target.value) || 0; api.updateStockItemWarehouseBinding(currentId, b.id, { max_qty: b.maxQty }); }} className="w-16 border-0 bg-transparent text-sm text-center" />,
                  ])} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Tech Card Creation Modal */}
      {showCreateTcModal && (
        <CreateTechCardModal
          sourceItemId={currentId}
          sourceItemName={item?.name || name}
          sourceItemUnit={selectedUnit}
          sourceItemBrutto={parseFloat(brutto) || 0}
          sourceItemColdLoss={parseFloat(coldLoss) || 0}
          onClose={() => setShowCreateTcModal(false)}
          onSaved={() => { setShowCreateTcModal(false); loadTechCards(); }}
        />
      )}

      {/* Tech Card View Modal */}
      {viewingTcId !== null && (
        <TechCardViewModal
          techCardId={viewingTcId}
          onClose={() => setViewingTcId(null)}
          onSaved={() => { setViewingTcId(null); loadTechCards(); }}
        />
      )}
    </div>
  );
}

function Table({ columns, data }: { columns: string[]; data: any[][] }) {
  if (data.length === 0) return <div className="text-center py-8 text-zinc-400 text-sm">Нет данных</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            {columns.map((c, i) => <th key={i} className="text-left px-3 py-2 text-xs font-medium text-zinc-500">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <button onClick={() => onPage(1)} disabled={page <= 1} className="text-xs bg-zinc-500 text-white px-2 py-1 rounded disabled:opacity-30">Первая</button>
      <button onClick={() => onPage(totalPages)} disabled={page >= totalPages} className="text-xs bg-zinc-500 text-white px-2 py-1 rounded disabled:opacity-30">Последняя</button>
      <span className="text-xs text-zinc-500">Стр. {page} из {totalPages}</span>
    </div>
  );
}
