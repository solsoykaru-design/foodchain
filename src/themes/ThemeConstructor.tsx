import { useState, useEffect } from 'react';
import * as api from '../api';
import { PRESET_THEMES, applyThemeToDocument, type ThemeColors, type Theme } from './index';

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bgPrimary', label: 'Основной фон' },
  { key: 'bgSecondary', label: 'Дополнительный фон' },
  { key: 'textPrimary', label: 'Основной текст' },
  { key: 'textSecondary', label: 'Второстепенный текст' },
  { key: 'textHeading', label: 'Заголовки' },
  { key: 'accent', label: 'Акцентный цвет' },
  { key: 'buttonPrimary', label: 'Цвет кнопок' },
  { key: 'cardBg', label: 'Фон карточек' },
  { key: 'border', label: 'Цвет границ' },
  { key: 'error', label: 'Цвет ошибок' },
  { key: 'success', label: 'Цвет успеха' },
  { key: 'warning', label: 'Цвет предупреждений' },
];

export default function ThemeConstructor() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [colors, setColors] = useState<ThemeColors>(PRESET_THEMES[0].colors);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.request('/api/themes').then((list: any[]) => {
      setThemes(list.map(t => ({ ...t, colors: t.colors as ThemeColors })));
    }).catch(() => {});
  }, []);

  const setColor = (key: keyof ThemeColors, value: string) => {
    const next = { ...colors, [key]: value };
    setColors(next);
    applyThemeToDocument(next);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert('Введите название темы'); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.request(`/api/admin/themes/${editId}`, { method: 'PUT', body: JSON.stringify({ name, colors }) });
      } else {
        await api.request('/api/admin/themes', { method: 'POST', body: JSON.stringify({ name, colors }) });
      }
      const list = await api.request('/api/themes');
      setThemes(list.map((t: any) => ({ ...t, colors: t.colors as ThemeColors })));
      resetForm();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: Theme) => {
    setEditId(t.id);
    setName(t.name);
    setColors(t.colors);
    applyThemeToDocument(t.colors);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить тему?')) return;
    try {
      await api.request(`/api/admin/themes/${id}`, { method: 'DELETE' });
      setThemes(prev => prev.filter(t => t.id !== id));
      if (editId === id) resetForm();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setColors(PRESET_THEMES[0].colors);
    applyThemeToDocument(PRESET_THEMES[0].colors);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Конструктор тем</h2>
        <p className="text-sm text-zinc-500 mt-1">Создание и редактирование кастомных тем оформления</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Theme list */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-white">Доступные темы</h3>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[500px] overflow-y-auto">
            {themes.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="w-4 h-4 rounded-full border border-zinc-300" style={{ background: t.colors.bgPrimary as string }} />
                  <span className="w-4 h-4 rounded-full border border-zinc-300" style={{ background: t.colors.accent as string }} />
                  <span className="w-4 h-4 rounded-full border border-zinc-300" style={{ background: t.colors.textPrimary as string }} />
                </div>
                <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">{t.name}</span>
                {t.isPreset ? (
                  <span className="text-[10px] text-zinc-400 font-medium">Пресет</span>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(t)} className="text-[11px] text-blue-500 hover:text-blue-600 font-medium px-2 py-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">Ред.</button>
                    <button onClick={() => handleDelete(t.id)} className="text-[11px] text-red-500 hover:text-red-600 font-medium px-2 py-0.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">Уд.</button>
                  </div>
                )}
              </div>
            ))}
            {themes.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">Загрузка...</p>}
          </div>
        </div>

        {/* Constructor */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-zinc-900 dark:text-white">
            {editId ? 'Редактировать тему' : 'Новая тема'}
          </h3>

          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Название темы</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              placeholder="Моя тема" />
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {COLOR_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-xs text-zinc-500 w-40 shrink-0">{f.label}</label>
                <div className="relative">
                  <input type="color" value={colors[f.key]} onChange={e => setColor(f.key, e.target.value)}
                    className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-transparent" />
                </div>
                <input type="text" value={colors[f.key]} onChange={e => setColor(f.key, e.target.value)}
                  className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono" />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]">
              {saving ? 'Сохранение...' : editId ? 'Сохранить изменения' : 'Создать тему'}
            </button>
            {editId && (
              <button onClick={resetForm}
                className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97]">
                Отмена
              </button>
            )}
          </div>

          {/* Live preview */}
          <div className="mt-4 p-4 rounded-xl" style={{ background: colors.bgPrimary, border: `1px solid ${colors.border}` }}>
            <h4 style={{ color: colors.textHeading, fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Предпросмотр
            </h4>
            <p style={{ color: colors.textPrimary, fontSize: 13, marginBottom: 12 }}>
              Основной текст темы. Здесь отображаются текущие цвета.
            </p>
            <p style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
              Второстепенный текст с дополнительной информацией.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span style={{ background: colors.buttonPrimary, color: '#FFFFFF', padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                Кнопка
              </span>
              <span style={{ background: colors.success, color: '#FFFFFF', padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                Успех
              </span>
              <span style={{ background: colors.error, color: '#FFFFFF', padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                Ошибка
              </span>
              <span style={{ background: colors.warning, color: '#FFFFFF', padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                Внимание
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
