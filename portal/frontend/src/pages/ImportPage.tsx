import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Table2, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = window.location.pathname.startsWith('/portal') ? '/portal/api' : '/api';

const MENU_FIELDS = [
  { value: 'name', label: 'Наименование', required: true },
  { value: 'category', label: 'Категория', required: true },
  { value: 'price', label: 'Цена', required: true },
  { value: 'cost', label: 'Себестоимость' },
  { value: 'description', label: 'Описание' },
  { value: 'unit', label: 'Ед. изм.' },
  { value: 'gross_weight', label: 'Брутто' },
  { value: 'net_weight', label: 'Нетто' },
  { value: 'kcal', label: 'Ккал' },
  { value: 'proteins', label: 'Белки' },
  { value: 'fats', label: 'Жиры' },
  { value: 'carbs', label: 'Углеводы' },
  { value: 'is_active', label: 'Активный' },
  { value: 'energy_display', label: 'Отображение энергии' },
  { value: 'weight_by_tech_card', label: 'Вес по тех.карте' },
  { value: 'calories_by_tech_card', label: 'Калории по тех.карте' },
  { value: 'heat_treatment', label: 'Тепловая обработка' },
];

const TECH_CARD_FIELDS = [
  { value: 'dish_name', label: 'Название блюда/заготовки', required: true },
  { value: 'valid_from', label: 'Действительна с', required: true },
  { value: 'portions', label: 'Кол-во порций', required: true },
  { value: 'technology', label: 'Технология приготовления' },
  { value: 'fixed_costs', label: 'Постоянные издержки' },
  { value: 'package_weight', label: 'Вес упаковки' },
  { value: 'ingredient_name', label: 'Складской элемент', required: true },
  { value: 'quantity', label: 'Кол-во' },
  { value: 'netto', label: 'Нетто' },
  { value: 'yield', label: 'Выход, кг' },
  { value: 'unit', label: 'Единица измерения' },
];

const REQUIRED_MENU = ['name', 'category', 'price'];
const REQUIRED_TECH = ['dish_name', 'valid_from', 'portions', 'ingredient_name'];

const KEYWORDS: Record<string, string[]> = {
  name: ['наименование', 'название', 'блюдо', 'name', 'наим'],
  category: ['категория', 'категори', 'category', 'раздел', 'групп'],
  price: ['цена', 'price', 'стоимость'],
  cost: ['себестоимость', 'cost', 'затрат'],
  description: ['описание', 'description', 'опис'],
  unit: ['ед', 'единиц', 'unit', 'изм', 'единица'],
  gross_weight: ['брутто', 'gross', 'вес брутто'],
  net_weight: ['нетто', 'net', 'вес нетто'],
  kcal: ['ккал', 'калорий', 'калорийность', 'kcal'],
  proteins: ['белки', 'protein', 'proteins', 'белок'],
  fats: ['жиры', 'жир', 'fat', 'fats'],
  carbs: ['углеводы', 'углевод', 'carbs', 'carbohydrates'],
  is_active: ['активный', 'активен', 'active', 'актив'],
  energy_display: ['отображение энергии', 'energy display', 'энергия'],
  weight_by_tech_card: ['вес по тех', 'вес по тк', 'вес тк'],
  calories_by_tech_card: ['калории по тех', 'калории по тк', 'калорийность тк'],
  heat_treatment: ['тепловая обработка', 'термическая', 'heat', 'обработк'],
  dish_name: ['название блюда', 'наименование блюда', 'наименование', 'блюдо', 'заготовк', 'dish'],
  valid_from: ['действительна с', 'срок', 'дата', 'valid from', 'valid_from'],
  portions: ['кол-во порций', 'порций', 'порции', 'количество порций', 'portions'],
  technology: ['технология', 'приготовлени', 'technology', 'рецепт'],
  fixed_costs: ['постоянные издержки', 'издержки', 'fixed costs', 'накладн'],
  package_weight: ['вес упаковки', 'упаковк', 'package weight'],
  ingredient_name: ['складской элемент', 'ингредиент', 'наименование ингредиента', 'ингр'],
  quantity: ['кол-во', 'количество', 'quantity', 'колич'],
  netto: ['нетто', 'net weight', 'вес нетто', 'netto'],
  yield: ['выход', 'yield', 'выход кг'],
};

function autoDetectMapping(columns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const col of columns) {
    const colLower = col.toLowerCase().trim();
    let bestMatch = '';
    let bestScore = 0;
    for (const [field, words] of Object.entries(KEYWORDS)) {
      for (const word of words) {
        if (colLower.includes(word) && word.length > bestScore) {
          bestScore = word.length;
          bestMatch = field;
        }
      }
    }
    mapping[col] = bestMatch;
  }
  return mapping;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [updateExisting, setUpdateExisting] = useState(true);
  const [createCategories, setCreateCategories] = useState(true);
  const [updateMode, setUpdateMode] = useState<'replace' | 'append'>('replace');
  const [createIngredients, setCreateIngredients] = useState(true);

  const fields = activeTab === 0 ? MENU_FIELDS : TECH_CARD_FIELDS;
  const requiredFields = activeTab === 0 ? REQUIRED_MENU : REQUIRED_TECH;

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.name.match(/\.xlsx?$/i)) {
      setError('Пожалуйста, выберите файл формата .xlsx или .xls');
      return;
    }
    setError('');
    setResult(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const cols = json.length > 0 ? Object.keys(json[0]) : [];
        setColumns(cols);
        setPreview(json.slice(0, 10));
        setMapping(autoDetectMapping(cols));
      } catch {
        setError('Не удалось прочитать файл. Проверьте его формат.');
      }
    };
    reader.onerror = () => setError('Ошибка чтения файла');
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleMappingChange = (column: string, value: string) => {
    setMapping(prev => ({ ...prev, [column]: value }));
  };

  const validateMapping = (): string | null => {
    const mappedValues = Object.values(mapping);
    for (const req of requiredFields) {
      if (!mappedValues.includes(req)) {
        const fieldLabel = fields.find(f => f.value === req)?.label || req;
        return `Поле "${fieldLabel}" обязательно для импорта`;
      }
    }
    return null;
  };

  const handleImport = async () => {
    const validationError = validateMapping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const fileData = await file!.arrayBuffer();
      const formData = new FormData();
      formData.append('file', new Blob([fileData]), file!.name);
      formData.append('column_mapping', JSON.stringify(mapping));

      const settings = activeTab === 0
        ? { update_existing: updateExisting, create_categories: createCategories }
        : { update_existing: updateExisting, update_mode: updateMode, create_ingredients: createIngredients };
      formData.append('settings', JSON.stringify(settings));

      const endpoint = activeTab === 0 ? `${API_BASE}/import/menu` : `${API_BASE}/import/tech-cards`;
      const token = localStorage.getItem('fc_portal_token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
      setResult({ success: true, ...data });
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setColumns([]);
    setPreview([]);
    setMapping({});
    setResult(null);
    setError('');
    setLoading(false);
  };

  const renderUploadArea = () => (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-zinc-300 hover:border-zinc-400 bg-white'
      }`}
    >
      <Upload size={40} className="mx-auto mb-4 text-zinc-300" />
      <p className="text-zinc-600 font-medium mb-1">Перетащите файл сюда или нажмите для выбора</p>
      <p className="text-sm text-zinc-400">Поддерживаются форматы .xlsx и .xls</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
        hidden
      />
    </div>
  );

  const renderFileInfo = () => {
    if (!file) return null;
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
        <FileSpreadsheet size={20} className="text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-800 truncate">{file.name}</p>
          <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
        </div>
        <button
          onClick={resetForm}
          className="text-sm text-zinc-500 hover:text-red-600 transition shrink-0"
        >
          Удалить
        </button>
      </div>
    );
  };

  const renderPreviewTable = () => {
    if (columns.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="font-bold text-zinc-800 mb-3 flex items-center gap-2">
          <Table2 size={16} className="text-zinc-400" />
          Предпросмотр (первые {preview.length} строк)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50">
                <th className="text-left px-3 py-2 font-medium text-zinc-500 text-xs">#</th>
                {columns.map(col => (
                  <th key={col} className="text-left px-3 py-2 font-medium text-zinc-500 text-xs whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{i + 1}</td>
                  {columns.map(col => (
                    <td key={col} className="px-3 py-2 text-zinc-700 whitespace-nowrap max-w-[200px] truncate">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderColumnMapping = () => {
    if (columns.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="font-bold text-zinc-800 mb-3">Сопоставление колонок</h3>
        <div className="space-y-2">
          {columns.map(col => (
            <div key={col} className="flex items-center gap-3 bg-white border border-zinc-200 rounded-lg px-4 py-2.5">
              <span className="font-medium text-zinc-800 min-w-[160px]">{col}</span>
              <ArrowRight size={14} className="text-zinc-300 shrink-0" />
              <select
                value={mapping[col] ?? ''}
                onChange={(e) => handleMappingChange(col, e.target.value)}
                className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                <option value="">(Пропустить)</option>
                {fields.map(f => (
                  <option key={f.value} value={f.value}>{f.label}{f.required ? ' *' : ''}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    if (columns.length === 0) return null;
    return (
      <div className="mb-6 bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="font-bold text-zinc-800 mb-4">Настройки импорта</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-700">Обновлять существующие {activeTab === 0 ? 'блюда' : 'техкарты'}</span>
          </label>
          {activeTab === 0 ? (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createCategories}
                onChange={(e) => setCreateCategories(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-700">Создавать отсутствующие категории</span>
            </label>
          ) : (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createIngredients}
                  onChange={(e) => setCreateIngredients(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700">Создавать отсутствующие ингредиенты</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 min-w-[160px]">Режим обновления:</span>
                <select
                  value={updateMode}
                  onChange={(e) => setUpdateMode(e.target.value as 'replace' | 'append')}
                  className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="replace">Заменить ингредиенты</option>
                  <option value="append">Дополнить новыми</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderImportButton = () => {
    if (columns.length === 0) return null;
    return (
      <button
        onClick={handleImport}
        disabled={loading}
        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Импортирование...
          </>
        ) : (
          <>
            <Upload size={18} />
            Импортировать
          </>
        )}
      </button>
    );
  };

  const renderResults = () => {
    if (!result) return null;
    const isSuccess = result.success;
    const hasErrors = result.errors && result.errors.length > 0;

    return (
      <div className={`rounded-2xl border p-6 ${isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          {isSuccess ? (
            <CheckCircle2 size={28} className="text-green-600" />
          ) : (
            <XCircle size={28} className="text-red-600" />
          )}
          <div>
            <h3 className="font-bold text-lg text-zinc-900">
              {isSuccess ? 'Импорт завершён' : 'Ошибка импорта'}
            </h3>
            {isSuccess && result.total_processed !== undefined && (
              <p className="text-sm text-zinc-600">
                Обработано строк: {result.total_processed}
              </p>
            )}
          </div>
        </div>

        {isSuccess && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {result.total_processed !== undefined && (
              <div className="bg-white rounded-xl px-4 py-3 border border-blue-200">
                <div className="text-xl font-bold text-blue-700">{result.total_processed}</div>
                <div className="text-xs text-zinc-500">Всего строк обработано</div>
              </div>
            )}
            {result.created !== undefined && (
              <div className="bg-white rounded-xl px-4 py-3 border border-green-200">
                <div className="text-xl font-bold text-green-700">{result.created}</div>
                <div className="text-xs text-zinc-500">Создано</div>
              </div>
            )}
            {result.updated !== undefined && (
              <div className="bg-white rounded-xl px-4 py-3 border border-amber-200">
                <div className="text-xl font-bold text-amber-700">{result.updated}</div>
                <div className="text-xs text-zinc-500">Обновлено</div>
              </div>
            )}
            {result.skipped !== undefined && (
              <div className="bg-white rounded-xl px-4 py-3 border border-zinc-200">
                <div className="text-xl font-bold text-zinc-700">{result.skipped}</div>
                <div className="text-xs text-zinc-500">Пропущено</div>
              </div>
            )}
          </div>
        )}

        {!isSuccess && result.error && (
          <div className="flex items-center gap-2 text-red-700 mb-4">
            <AlertTriangle size={16} />
            <span className="text-sm">{result.error}</span>
          </div>
        )}

        {hasErrors && (
          <div className="mb-4">
            <h4 className="font-medium text-red-800 text-sm mb-2 flex items-center gap-1">
              <XCircle size={14} />
              Ошибки ({result.errors.length})
            </h4>
            <div className="bg-white rounded-xl border border-red-200 max-h-48 overflow-y-auto">
              {result.errors.map((err: any, i: number) => (
                <div
                  key={i}
                  className={`px-4 py-2 text-sm flex items-start gap-2 ${
                    i % 2 === 0 ? 'bg-red-50/50' : 'bg-white'
                  }`}
                >
                  <span className="text-red-500 font-medium shrink-0">Строка {err.row || '?'}:</span>
                  <span className="text-red-700">{err.message || err.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={resetForm}
          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
        >
          <ArrowRight size={14} />
          Начать новый импорт
        </button>
      </div>
    );
  };

  const renderTabContent = () => (
    <>
      {renderFileInfo()}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-red-700 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      {!file ? renderUploadArea() : (
        <>
          {renderPreviewTable()}
          {renderColumnMapping()}
          {renderSettings()}
          {renderImportButton()}
        </>
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Импорт данных</h1>

      <div className="flex gap-1 mb-8 border-b border-zinc-200">
        {['Импорт меню', 'Импорт техкарт'].map((label, i) => (
          <button
            key={i}
            onClick={() => { setActiveTab(i); resetForm(); }}
            className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === i
                ? 'text-orange-600 border-orange-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {result ? renderResults() : renderTabContent()}
    </div>
  );
}
