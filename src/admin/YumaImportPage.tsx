import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

type ImportType = 'items' | 'tech-cards' | 'stock';

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

const FIELD_DEFS: Record<ImportType, FieldDef[]> = {
  items: [
    { key: 'name', label: 'Наименование *', required: true },
    { key: 'category', label: 'Категория *', required: true },
    { key: 'price', label: 'Цена *', required: true },
    { key: 'unit', label: 'Ед. изм. элемента', required: true },
    { key: 'is_active', label: 'Активный', required: false },
    { key: 'kcal', label: 'Ккал', required: false },
    { key: 'proteins', label: 'Белки', required: false },
    { key: 'fats', label: 'Жиры', required: false },
    { key: 'carbohydrates', label: 'Углеводы', required: false },
    { key: 'gross_weight', label: 'Брутто', required: false },
    { key: 'net_weight', label: 'Нетто', required: false },
    { key: 'weight_by_tech_card', label: 'Вес по тех. карте', required: false },
    { key: 'heat_treatment', label: 'Тепловая обработка', required: false },
    { key: 'is_returnable', label: 'Возвратный', required: false },
    { key: 'honest_sign', label: 'Честный знак', required: false },
    { key: 'is_18plus', label: 'Товар 18+', required: false },
    { key: 'is_tobacco', label: 'Табак', required: false },
    { key: 'recipe_text', label: 'Технология приготовления', required: false },
    { key: 'composition', label: 'Состав', required: false },
    { key: 'barcode', label: 'Штрихкод', required: false },
    { key: 'article', label: 'Артикул', required: false },
    { key: 'external_id', label: 'Внешний id', required: false },
    { key: 'description', label: 'Описание', required: false },
    { key: 'prep_time_minutes', label: 'Время сборки', required: false },
    { key: 'bonus_payment_percent', label: 'Оплата баллами %', required: false },
    { key: 'sort_order', label: 'Порядок', required: false },
    { key: 'tax_rate', label: 'Налог', required: false },
  ],
  'tech-cards': [
    { key: 'dish_name', label: 'Название блюда/заготовки *', required: true },
    { key: 'ingredient_name', label: 'Складской элемент', required: false },
    { key: 'quantity', label: 'Кол-во', required: false },
    { key: 'netto', label: 'Нетто', required: false },
    { key: 'yield', label: 'Выход, кг', required: false },
    { key: 'ingredient_unit', label: 'Ед. изм. ингредиента', required: false },
    { key: 'valid_from', label: 'Действительна с', required: false },
    { key: 'portions', label: 'Кол-во порций в техкарте', required: false },
    { key: 'technology', label: 'Технология приготовления', required: false },
    { key: 'fixed_costs', label: 'Постоянные издержки', required: false },
    { key: 'package_weight', label: 'Вес упаковки', required: false },
    { key: 'output', label: 'Выход', required: false },
  ],
  stock: [
    { key: 'name', label: 'Наименование *', required: true },
    { key: 'category', label: 'Категория *', required: true },
    { key: 'unit', label: 'Единица измерения', required: true },
    { key: 'cost', label: 'Себестоимость', required: false },
    { key: 'is_returnable', label: 'Возвратный', required: false },
    { key: 'gross_weight', label: 'Брутто', required: false },
    { key: 'net_weight', label: 'Нетто', required: false },
    { key: 'kcal', label: 'Ккал', required: false },
    { key: 'proteins', label: 'Белки', required: false },
    { key: 'fats', label: 'Жиры', required: false },
    { key: 'carbohydrates', label: 'Углеводы', required: false },
  ],
};

const TAB_CONFIG: { key: ImportType; label: string; desc: string }[] = [
  { key: 'items', label: 'Элементы меню', desc: 'Импорт блюд, категорий, цен, БЖУ, меток и аллергенов' },
  { key: 'tech-cards', label: 'Техкарты', desc: 'Импорт технологических карт с ингредиентами' },
  { key: 'stock', label: 'Склад', desc: 'Импорт складских элементов с категориями' },
];

function autoDetectMap(xlsxCols: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-zа-яё0-9]/g, '');
  for (const xc of xlsxCols) {
    const xcNorm = norm(xc);
    let bestField: string | null = null;
    let bestScore = 0;
    for (const fd of fields) {
      const fdNorm = norm(fd.label.replace('*', '').trim());
      const score = [fdNorm, fd.key.toLowerCase(), ...fd.key.split('_').map(norm)].some(t => xcNorm.includes(t) || t.includes(xcNorm)) ? 1 : 0;
      if (score > bestScore) { bestScore = score; bestField = fd.key; }
    }
    if (bestField) map[xc] = bestField;
  }
  return map;
}

function parsePreviewData(json: any[]): { columns: string[]; rows: Record<string, string>[] } {
  if (!json.length) return { columns: [], rows: [] };
  const columns = Object.keys(json[0]);
  const rows = json.slice(0, 10).map(r => {
    const row: Record<string, string> = {};
    for (const col of columns) row[col] = String(r[col] ?? '').slice(0, 60);
    return row;
  });
  return { columns, rows };
}

export default function YumaImportPage() {
  const [tab, setTab] = useState<ImportType>('items');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, string>[] } | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [step, setStep] = useState<'file' | 'mapping' | 'result'>('file');
  const [showSkipped, setShowSkipped] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = FIELD_DEFS[tab];

  const handleFile = (f: File) => {
    setFile(f);
    setReport(null);
    setMap({});
    setStep('file');
    setAllRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!json.length) { addToast('Файл не содержит данных', 'error'); return; }

        const parsed = parsePreviewData(json);
        setPreview(parsed);
        setAllRows(json);

        const detected = autoDetectMap(parsed.columns, fields);
        setMap(detected);
        setStep('mapping');
      } catch (err: any) {
        addToast('Ошибка чтения файла: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!allRows.length) return;
    setImporting(true);
    setReport(null);
    try {
      const res = await api.request(`/api/yuma-import/${tab}`, {
        method: 'POST',
        body: JSON.stringify({ rows: allRows, map }),
      });
      setReport(res);
      setStep('result');
      const total = res.created.length + res.updated.length;
      const msg = `Импортировано: ${res.created.length} создано, ${res.updated.length} обновлено`;
      if (res.errors?.length) addToast(`${msg}, ${res.errors.length} ошибок`, 'warning');
      else addToast(msg, 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка импорта', 'error');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setMap({});
    setReport(null);
    setAllRows([]);
    setStep('file');
    setShowSkipped(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const unmapCols = preview ? preview.columns.filter(c => !map[c]) : [];
  const hasRequired = fields.filter(f => f.required).every(f => Object.values(map).includes(f.key));

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Импорт из YUMA</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Перенос данных из YUMA: меню, техкарты, склад</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-0">
        {TAB_CONFIG.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); reset(); }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px
              ${tab === t.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {step === 'file' && (
        <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors bg-white dark:bg-zinc-900">
          <Upload size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-base font-medium text-zinc-600 dark:text-zinc-400 mb-1">Перетащите XLSX-файл сюда или нажмите для выбора</p>
          <p className="text-sm text-zinc-400 mb-4">Поддерживаются форматы .xlsx, .xls</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
          <div className="text-xs text-zinc-400 space-y-1">
            <p>Для {TAB_CONFIG.find(t => t.key === tab)?.desc}</p>
          </div>
        </div>
      )}

      {step === 'mapping' && preview && (
        <div className="space-y-5">
          {allRows.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">Всего строк: <strong className="text-zinc-700 dark:text-zinc-300">{allRows.length}</strong></p>
              <p className="text-xs font-medium text-zinc-500 mb-3">Предпросмотр первых {Math.min(10, preview.rows.length)} строк:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                      <th className="px-2 py-1.5 text-left font-semibold text-zinc-500 uppercase whitespace-nowrap">#</th>
                      {preview.columns.map(col => (
                        <th key={col} className="px-2 py-1.5 text-left font-semibold text-zinc-500 uppercase whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                        <td className="px-2 py-1 text-zinc-400 whitespace-nowrap">{i + 1}</td>
                        {preview.columns.map(col => (
                          <td key={col} className="px-2 py-1 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Column mapping */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Сопоставление колонок</h3>
            <p className="text-xs text-zinc-400 mb-4">Укажите, какая колонка из файла соответствует какому полю системы</p>

            <div className="space-y-2 max-w-2xl">
              {preview.columns.map(col => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-40 shrink-0 truncate" title={col}>
                    {col}
                    {map[col] && <CheckCircle size={12} className="inline ml-1 text-emerald-500" />}
                  </span>
                  <select value={map[col] || ''} onChange={e => setMap(m => ({ ...m, [col]: e.target.value }))}
                    className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400">
                    <option value="">— Не импортировать —</option>
                    {fields.map(fd => (
                      <option key={fd.key} value={fd.key}>
                        {fd.label} {fd.required ? '(обяз.)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {unmapCols.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                {unmapCols.length} колонок не сопоставлено. Некоторые данные могут быть пропущены.
              </p>
            )}
            {!hasRequired && (
              <p className="text-xs text-red-500 mt-2">
                Сопоставьте все обязательные поля (отмечены *) перед импортом.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={reset}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
              Назад
            </button>
            <button onClick={handleImport} disabled={importing || !hasRequired}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]
                ${importing || !hasRequired ? 'bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-200'}`}>
              {importing ? <><Loader2 size={16} className="animate-spin" /> Импорт...</> : <><Upload size={16} /> Запустить импорт</>}
            </button>
          </div>

          {/* Progress during import */}
          {importing && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Импорт данных...</p>
                <p className="text-xs text-blue-500">Обрабатывается {allRows.length} строк</p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'result' && report && (
        <div className="space-y-5">
          <div className={`rounded-xl border p-5 ${
            report.errors?.length
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              {report.errors?.length ? <AlertTriangle size={24} className="text-amber-500" /> : <CheckCircle size={24} className="text-emerald-500" />}
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Импорт завершён</h3>
                <p className="text-sm text-zinc-500">Обработано {report.total || 0} строк</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center border border-zinc-200 dark:border-zinc-700">
                <p className="text-2xl font-bold text-emerald-600">{report.created?.length || 0}</p>
                <p className="text-xs text-zinc-500">Создано</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center border border-zinc-200 dark:border-zinc-700">
                <p className="text-2xl font-bold text-blue-600">{report.updated?.length || 0}</p>
                <p className="text-xs text-zinc-500">Обновлено</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center border border-zinc-200 dark:border-zinc-700">
                <p className={`text-2xl font-bold ${report.errors?.length ? 'text-red-500' : 'text-zinc-400'}`}>{report.errors?.length || 0}</p>
                <p className="text-xs text-zinc-500">Ошибок</p>
              </div>
            </div>

            {report.ingredientsCreated !== undefined && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center border border-zinc-200 dark:border-zinc-700 mb-4">
                <p className="text-2xl font-bold text-indigo-600">{report.ingredientsCreated}</p>
                <p className="text-xs text-zinc-500">Ингредиентов добавлено</p>
              </div>
            )}

            {report.created?.length > 0 && (
              <details className="mb-2">
                <summary className="text-xs font-medium text-emerald-600 cursor-pointer hover:text-emerald-700">Создано ({report.created.length})</summary>
                <div className="mt-1 max-h-24 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                  {report.created.map((n: string, i: number) => <div key={i}>{n}</div>)}
                </div>
              </details>
            )}
            {report.updated?.length > 0 && (
              <details className="mb-2">
                <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">Обновлено ({report.updated.length})</summary>
                <div className="mt-1 max-h-24 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                  {report.updated.map((n: string, i: number) => <div key={i}>{n}</div>)}
                </div>
              </details>
            )}
            {report.errors?.length > 0 && (
              <details open>
                <summary className="text-xs font-medium text-red-600 cursor-pointer hover:text-red-700">Ошибки ({report.errors.length})</summary>
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
                  {report.errors.map((e: string, i: number) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded">{e}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={reset}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition shadow-sm active:scale-[0.97]">
              Импортировать ещё
            </button>
            <button onClick={() => setTab(tab === 'items' ? 'tech-cards' : tab === 'tech-cards' ? 'stock' : 'items')}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
              Перейти к {tab === 'items' ? 'техкартам' : tab === 'tech-cards' ? 'складу' : 'меню'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
