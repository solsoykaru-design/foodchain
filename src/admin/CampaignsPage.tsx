import { useEffect, useState } from 'react';
import * as api from '../api';
import { Plus, Send, Trash2, X, Megaphone, BarChart3, Play } from 'lucide-react';
import { addToast } from '../ToastContext';

const SEGMENTS = [
  { value: '', label: 'Все клиенты' },
  { value: 'champions', label: 'Чемпионы' },
  { value: 'loyal', label: 'Лояльные' },
  { value: 'new', label: 'Новые' },
  { value: 'potential', label: 'Потенциал' },
  { value: 'at_risk', label: 'В зоне риска' },
  { value: 'hibernating', label: 'Спящие' },
];

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Ручная рассылка' },
  { value: 'birthday', label: 'День рождения' },
  { value: 'inactive_days', label: 'Неактивность N дней' },
  { value: 'abandoned_cart', label: 'Брошенная корзина' },
  { value: 'loyalty_level_up', label: 'Повышение уровня лояльности' },
];

const LOYALTY_LEVELS = ['новичок', 'серебряный', 'золотой', 'платиновый'];

interface Variant {
  name: string;
  messageTitle: string;
  messageBody: string;
  weight: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [channel, setChannel] = useState('push');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [abEnabled, setAbEnabled] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'A', messageTitle: '', messageBody: '', weight: 50 },
    { name: 'B', messageTitle: '', messageBody: '', weight: 50 },
  ]);
  const [runningTriggers, setRunningTriggers] = useState(false);

  const load = async () => { try { setCampaigns(await api.request('/api/campaigns')); } catch {} };
  useEffect(() => { load(); }, []);

  const runTriggers = async () => {
    setRunningTriggers(true);
    try {
      const r = await api.request('/api/campaigns/triggers/run', { method: 'POST' });
      const total = r.result?.reduce((s: number, x: any) => s + (x.sent || 0), 0) || 0;
      addToast(`Триггеры выполнены. Отправлено: ${total}`, 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setRunningTriggers(false); }
  };

  const openStats = async (id: number) => {
    try {
      const c = await api.request(`/api/campaigns/${id}`);
      setSelectedCampaign(c);
      const s = await api.request(`/api/campaigns/${id}/stats`);
      setStats(s);
    } catch {}
  };

  const create = async () => {
    try {
      await api.request('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name, channel, messageTitle: title, messageBody: body,
          triggerType,
          triggerConfig,
          segmentFilter: segment ? { segment } : {},
          discountPercent, bonusAmount,
          abEnabled,
          abConfig: abEnabled ? { variants: variants.filter(v => v.messageTitle || v.messageBody) } : {},
        }),
      });
      addToast('Кампания создана', 'success');
      setShowCreate(false);
      setName(''); setSegment(''); setTriggerType('manual'); setTriggerConfig({}); setTitle(''); setBody(''); setDiscountPercent(0); setBonusAmount(0); setAbEnabled(false);
      setVariants([{ name: 'A', messageTitle: '', messageBody: '', weight: 50 }, { name: 'B', messageTitle: '', messageBody: '', weight: 50 }]);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const send = async (id: number) => {
    try {
      const r = await api.request(`/api/campaigns/${id}/send`, { method: 'POST' });
      addToast(`Отправлено: ${r.sent}`, 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить кампанию?')) return;
    try { await api.request(`/api/campaigns/${id}`, { method: 'DELETE' }); addToast('Кампания удалена', 'success'); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const updateVariant = (idx: number, field: keyof Variant, value: any) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone /> Автокампании</h1>
        <div className="flex gap-2">
          <button onClick={runTriggers} disabled={runningTriggers} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 disabled:opacity-50"><Play size={18} /> Запустить триггеры</button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2"><Plus size={18} /> Создать кампанию</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.id} className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-xs opacity-70">{c.channel} · {c.triggerType !== 'manual' ? `триггер: ${TRIGGER_TYPES.find(t => t.value === c.triggerType)?.label || c.triggerType} · ` : ''}{c.status} · отправлено {c.sentCount}</p>
                  <p className="text-sm mt-1">{c.messageTitle}</p>
                  <p className="text-xs opacity-80">{c.messageBody}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openStats(c.id)} className="px-3 py-1.5 bg-zinc-600 text-white text-xs rounded-lg flex items-center gap-1"><BarChart3 size={14} /> Статистика</button>
                  {c.triggerType === 'manual' && c.status !== 'sent' && <button onClick={() => send(c.id)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"><Send size={14} /> Отправить</button>}
                  <button onClick={() => remove(c.id)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"><Trash2 size={14} /> Удалить</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedCampaign && stats && (
          <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold flex items-center gap-2"><BarChart3 size={18} /> Статистика кампании</h2>
              <button onClick={() => setSelectedCampaign(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800"><p className="text-xs opacity-70">Отправлено</p><p className="text-lg font-bold">{stats.sent}</p></div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800"><p className="text-xs opacity-70">Открыто</p><p className="text-lg font-bold">{stats.opened}</p></div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800"><p className="text-xs opacity-70">Конверсия</p><p className="text-lg font-bold">{stats.converted}</p></div>
            </div>
            {stats.variants?.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800"><tr><th className="px-2 py-1 text-left">Вариант</th><th className="px-2 py-1 text-right">Отправлено</th><th className="px-2 py-1 text-right">Конверсия</th></tr></thead>
                <tbody>
                  {stats.variants.map((v: any) => (
                    <tr key={v.name} className="border-t dark:border-zinc-800"><td className="px-2 py-1">{v.name}</td><td className="px-2 py-1 text-right">{v.sent}</td><td className="px-2 py-1 text-right">{v.conversion}%</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Новая кампания</h2>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Название" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <select value={segment} onChange={e => setSegment(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {triggerType === 'birthday' && (
              <div className="mb-3">
                <label className="text-xs font-medium text-zinc-500">За сколько дней до ДР отправить</label>
                <input type="number" min={0} max={30} value={triggerConfig.daysBefore || 0} onChange={e => setTriggerConfig({ ...triggerConfig, daysBefore: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
              </div>
            )}
            {triggerType === 'inactive_days' && (
              <div className="mb-3">
                <label className="text-xs font-medium text-zinc-500">Дней неактивности</label>
                <input type="number" min={1} value={triggerConfig.days || 30} onChange={e => setTriggerConfig({ ...triggerConfig, days: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
              </div>
            )}
            {triggerType === 'abandoned_cart' && (
              <div className="mb-3">
                <label className="text-xs font-medium text-zinc-500">Минут после брошенной корзины</label>
                <input type="number" min={1} value={triggerConfig.minutes || 30} onChange={e => setTriggerConfig({ ...triggerConfig, minutes: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
              </div>
            )}
            {triggerType === 'loyalty_level_up' && (
              <div className="mb-3">
                <label className="text-xs font-medium text-zinc-500">Целевой уровень лояльности</label>
                <select value={triggerConfig.level || 'серебряный'} onChange={e => setTriggerConfig({ ...triggerConfig, level: e.target.value })} className="w-full px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
                  {LOYALTY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
              <option value="push">Push</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
            <label className="flex items-center gap-2 mb-3 text-sm"><input type="checkbox" checked={abEnabled} onChange={e => setAbEnabled(e.target.checked)} /> A/B тестирование</label>
            {!abEnabled && (
              <>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Текст сообщения" rows={3} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
              </>
            )}
            {abEnabled && (
              <div className="space-y-3 mb-3">
                {variants.map((v, idx) => (
                  <div key={idx} className="p-3 rounded-xl border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                    <p className="text-xs font-bold mb-1">Вариант {v.name} · вес {v.weight}%</p>
                    <input type="text" value={v.messageTitle} onChange={e => updateVariant(idx, 'messageTitle', e.target.value)} placeholder="Заголовок" className="w-full mb-2 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
                    <textarea value={v.messageBody} onChange={e => updateVariant(idx, 'messageBody', e.target.value)} placeholder="Текст" rows={2} className="w-full px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-3">
              <input type="number" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} placeholder="Скидка %" className="flex-1 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
              <input type="number" value={bonusAmount} onChange={e => setBonusAmount(Number(e.target.value))} placeholder="Бонусы" className="flex-1 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 font-semibold">Отмена</button>
              <button onClick={create} disabled={!name || (triggerType === 'manual' && !abEnabled && (!title || !body))} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
