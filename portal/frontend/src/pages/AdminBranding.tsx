import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Check } from 'lucide-react';

export function AdminBranding() {
  const [branding, setBranding] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getPlatformBranding()
      .then(setBranding)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePlatformBranding(branding);
      alert('Сохранено');
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Брендирование платформы</h1>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">Название платформы</label>
          <input value={branding.platform_name || ''} onChange={e => setBranding(p => ({ ...p, platform_name: e.target.value }))}
            className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">Основной цвет</label>
          <div className="flex gap-3 items-center">
            <input type="color" value={branding.primary_color || '#f97316'} onChange={e => setBranding(p => ({ ...p, primary_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-zinc-300 cursor-pointer" />
            <span className="text-sm text-zinc-500">{branding.primary_color}</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">Вторичный цвет</label>
          <div className="flex gap-3 items-center">
            <input type="color" value={branding.secondary_color || '#ef4444'} onChange={e => setBranding(p => ({ ...p, secondary_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-zinc-300 cursor-pointer" />
            <span className="text-sm text-zinc-500">{branding.secondary_color}</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">URL логотипа</label>
          <input value={branding.logo_url || ''} onChange={e => setBranding(p => ({ ...p, logo_url: e.target.value }))}
            placeholder="https://example.com/logo.png"
            className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-50">
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}
