import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import * as api from '../api';

const UNIT_OPTIONS = ['кг', 'г', 'л', 'мл', 'шт'];
const TAX_OPTIONS = ['Без НДС', '10%', '20%'];

interface Props {
  itemId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductModal({ itemId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // All form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('шт');
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
  const [isReturnable, setIsReturnable] = useState(false);
  const [excludeNeg, setExcludeNeg] = useState(false);
  const [beerType, setBeerType] = useState(false);
  const [alcoholType, setAlcoholType] = useState(false);
  const [tobaccoType, setTobaccoType] = useState(false);
  const [sugarType, setSugarType] = useState(false);
  const [kcal, setKcal] = useState('');
  const [proteins, setProteins] = useState('');
  const [fats, setFats] = useState('');
  const [carbs, setCarbs] = useState('');
  const [caloriesByTechCard, setCaloriesByTechCard] = useState(false);
  const [heatTreatment, setHeatTreatment] = useState(false);
  const [id1c, setId1c] = useState('');
  const [isMain, setIsMain] = useState(false);

  const tabs = ['Основное', 'Цена и налог', 'Опции', 'Пищевая ценность', 'Интеграции'];

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getStockItem(itemId);
        setName(data.name || '');
        setCategory(data.category || '');
        setUnit(data.unit || 'шт');
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
        setIsReturnable(!!data.isReturnable);
        setExcludeNeg(!!data.excludeNegControl);
        setBeerType(!!data.beerType);
        setAlcoholType(!!data.alcoholType);
        setTobaccoType(!!data.tobaccoType);
        setSugarType(!!data.sugarType);
        setKcal(String(data.kcal ?? ''));
        setProteins(String(data.proteins ?? ''));
        setFats(String(data.fats ?? ''));
        setCarbs(String(data.carbs ?? ''));
        setCaloriesByTechCard(!!data.caloriesByTechCard);
        setHeatTreatment(!!data.heatTreatment);
        setId1c(data.id1c || '');
        setIsMain(!!data.isMain);
      } catch (e: any) { setError(e.message || 'Ошибка загрузки'); }
      finally { setLoading(false); }
    })();
  }, [itemId]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    setSaving(true);
    setError('');
    try {
      await api.updateStockItem(itemId, {
        name, category, unit,
        brutto: parseFloat(brutto) || 0,
        netto: parseFloat(netto) || 0,
        coldLossPercent: parseFloat(coldLoss) || 0,
        weightByTechCard,
        barcode, article, gtin,
        basePrice: parseFloat(basePrice) || 0,
        withVat, taxRate,
        isMain,
        isReturnable: isReturnable,
        excludeNegControl: excludeNeg,
        beerType, alcoholType, tobaccoType, sugarType,
        kcal: parseFloat(kcal) || 0,
        proteins: parseFloat(proteins) || 0,
        fats: parseFloat(fats) || 0,
        carbs: parseFloat(carbs) || 0,
        caloriesByTechCard, heatTreatment,
        id1c,
      });
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[960px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {loading ? 'Загрузка...' : `Редактирование: ${name}`}
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition whitespace-nowrap ${
                tab === i
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-zinc-400">Загрузка...</div>
          ) : (
            <>
              {tab === 0 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Название *</label>
                    <input value={name} onChange={e => setName(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Категория</label>
                    <input value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Ед. изм.</label>
                    <select value={unit} onChange={e => setUnit(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Брутто, кг</label>
                    <input type="number" step="0.001" value={brutto} onChange={e => setBrutto(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Нетто, кг</label>
                    <input type="number" step="0.001" value={netto} onChange={e => setNetto(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Потери при холодной обработке, %</label>
                    <input type="number" step="0.1" value={coldLoss} onChange={e => setColdLoss(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={weightByTechCard} onChange={e => setWeightByTechCard(e.target.checked)}
                        className="rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Вес по тех. карте</span>
                    </label>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Штрихкод</label>
                    <input maxLength={14} value={barcode} onChange={e => setBarcode(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Артикул</label>
                    <input maxLength={50} value={article} onChange={e => setArticle(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Код GTIN</label>
                    <input maxLength={14} value={gtin} onChange={e => setGtin(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                </div>
              )}

              {tab === 1 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Базовая цена</label>
                    <input type="number" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div className="flex items-end gap-4 pb-2.5">
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
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Налог</label>
                    <select value={taxRate} onChange={e => setTaxRate(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                      {TAX_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Текущая себестоимость</label>
                    <input readOnly value={currentCost} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Последняя цена</label>
                    <input readOnly value={lastPrice} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed" />
                  </div>
                </div>
              )}

              {tab === 2 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {([
                    [isReturnable, setIsReturnable, 'Возвратный'],
                    [excludeNeg, setExcludeNeg, 'Исключить из контроля отрицательных остатков'],
                    [beerType, setBeerType, 'Пиво и пивные напитки'],
                    [alcoholType, setAlcoholType, 'Крепкий алкоголь'],
                    [tobaccoType, setTobaccoType, 'Табачный продукт'],
                    [sugarType, setSugarType, 'Сахаросодержащий напиток'],
                  ] as [boolean, (v: boolean) => void, string][]).map(([val, setter, label]) => (
                    <label key={label} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <input type="checkbox" checked={!!val} onChange={e => setter(e.target.checked)} className="w-4 h-4 rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              {tab === 3 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Ккал (на 100г)</label>
                    <input type="number" step="0.001" value={kcal} onChange={e => setKcal(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Белки (на 100г)</label>
                    <input type="number" step="0.001" value={proteins} onChange={e => setProteins(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Жиры (на 100г)</label>
                    <input type="number" step="0.001" value={fats} onChange={e => setFats(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Углеводы (на 100г)</label>
                    <input type="number" step="0.001" value={carbs} onChange={e => setCarbs(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={caloriesByTechCard} onChange={e => setCaloriesByTechCard(e.target.checked)} className="rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Калории по тех. карте</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={heatTreatment} onChange={e => setHeatTreatment(e.target.checked)} className="rounded" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Тепловая обработка</span>
                    </label>
                  </div>
                </div>
              )}

              {tab === 4 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Идентификатор 1С</label>
                    <input value={id1c} onChange={e => setId1c(e.target.value)}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!error && <div />}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
              Закрыть
            </button>
            <button onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97]">
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
