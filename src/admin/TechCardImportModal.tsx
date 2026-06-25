import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

interface ImportRow {
  dish_name: string;
  ingredients: string;
  output: number;
  technology: string;
  cooking_time: number;
}

export default function TechCardImportModal({ onClose, onImported }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      const parsed: ImportRow[] = data.map(row => ({
        dish_name: row['Блюдо'] || row['Название'] || row['dish_name'] || '',
        ingredients: row['Ингредиенты'] || row['Состав'] || row['ingredients'] || '',
        output: parseFloat(row['Выход'] || row['Вес'] || row['output'] || '0') || 0,
        technology: row['Технология'] || row['Приготовление'] || row['technology'] || '',
        cooking_time: parseInt(row['Время'] || row['Время готовки'] || row['cooking_time'] || '0') || 0,
      })).filter(r => r.dish_name);

      setRows(parsed);
      addToast(`Загружено ${parsed.length} строк`, 'success');
    } catch (e: any) {
      addToast('Ошибка чтения файла: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      addToast('Нет данных для импорта', 'error');
      return;
    }

    setLoading(true);
    try {
      let success = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          const ingredients = row.ingredients.split(/[;,]/).map(s => s.trim()).filter(Boolean).map(s => {
            const parts = s.split(/\s+/);
            const name = parts.slice(0, -1).join(' ');
            const qty = parseFloat(parts[parts.length - 1]) || 100;
            return { name, quantity: qty, unit: 'г' };
          });

          await api.request('/api/tech-cards/ai-save', {
            method: 'POST',
            body: JSON.stringify({
              dish_name: row.dish_name,
              ingredients,
              matched_ingredients: [],
              unmatched_ingredients: [],
              kbju_per_100g: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
              output: row.output,
              technology: row.technology,
              cooking_time: row.cooking_time,
            }),
          });
          success++;
        } catch {
          errors++;
        }
      }

      addToast(`Импортировано: ${success}, ошибок: ${errors}`, success > 0 ? 'success' : 'error');
      if (success > 0) onImported();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-green-500" /> Импорт техкарт
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">Формат файла XLSX:</p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• <b>Блюдо</b> — название блюда (обязательно)</li>
              <li>• <b>Ингредиенты</b> — список через запятую (название количество)</li>
              <li>• <b>Выход</b> — вес готового блюда в граммах</li>
              <li>• <b>Технология</b> — описание приготовления</li>
              <li>• <b>Время</b> — время готовки в минутах</li>
            </ul>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 hover:border-green-500 dark:hover:border-green-500 transition-colors"
            >
              {loading ? (
                <Loader size={24} className="animate-spin text-zinc-400" />
              ) : (
                <Upload size={24} className="text-zinc-400" />
              )}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {loading ? 'Чтение файла...' : fileName ? fileName : 'Выберите XLSX файл'}
              </span>
            </button>
          </div>

          {rows.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Предпросмотр ({rows.length} записей)</p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Блюдо</th>
                      <th className="text-right py-2 px-3">Выход</th>
                      <th className="text-right py-2 px-3">Время</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-zinc-900 dark:text-white">{row.dish_name}</td>
                        <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">{row.output}г</td>
                        <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">{row.cooking_time} мин</td>
                      </tr>
                    ))}
                    {rows.length > 10 && (
                      <tr>
                        <td colSpan={3} className="py-2 px-3 text-center text-zinc-400 italic">
                          ... и ещё {rows.length - 10} записей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              onClick={handleImport}
              disabled={loading || rows.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              {loading ? 'Импорт...' : 'Импортировать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
