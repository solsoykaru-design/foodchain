import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Megaphone, Plus, X, Edit3, Trash2, Send, BarChart4, Percent, Gift, Users, Eye, MessageSquare, ShoppingBag, Ticket, Award, BadgePercent } from 'lucide-react';

type Tab = 'campaigns' | 'promocodes' | 'analytics' | 'discounts' | 'bonuses' | 'certificates';

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [promocodes, setPromocodes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [bonusTxs, setBonusTxs] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);

  const load = async () => {
    try {
      const [c, p, a] = await Promise.all([api.getCampaigns(), api.getPromocodes(), api.getMarketingAnalytics()]);
      setCampaigns(c); setPromocodes(p); setAnalytics(a);
    } catch {}
    try { setDiscounts(await api.getDiscounts()); } catch {}
    try { setBonuses(await api.getBonuses()); } catch {}
    try { setBonusTxs(await api.getBonusTransactions()); } catch {}
    try { setCertificates(await api.getCertificates()); } catch {}
  };

  useEffect(() => { load(); }, []);

  const [showCampForm, setShowCampForm] = useState(false);
  const [editCamp, setEditCamp] = useState<any>(null);
  const [campForm, setCampForm] = useState({ name: '', type: 'manual', message: '', button_text: '', segment: 'all' });
  const saveCamp = async () => {
    try {
      if (editCamp) await api.updateCampaign(editCamp.id, campForm);
      else await api.createCampaign(campForm);
      setShowCampForm(false); setEditCamp(null); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const sendCampaign = async (id: number) => { try { await api.sendCampaign(id); load(); } catch (e: any) { addToast(e.message, 'error'); } };

  const [genType, setGenType] = useState('all');
  const [genLen, setGenLen] = useState(8);
  const generateCode = async (setCode: (code: string) => void) => {
    try { const { code } = await api.generateCode(genType, genLen); setCode(code); } catch {}
  };

  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editPromo, setEditPromo] = useState<any>(null);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percent', value: 10, min_order: 0, max_uses: 100, expires_at: '' });
  const savePromo = async () => {
    try {
      if (editPromo) await api.updatePromocode(editPromo.id, promoForm);
      else await api.createPromocode(promoForm);
      setShowPromoForm(false); setEditPromo(null); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const delPromo = async (id: number) => { if (!confirm('Удалить промокод?')) return; try { await api.deletePromocode(id); load(); } catch (e: any) { addToast(e.message, 'error'); } };

  const [showPushForm, setShowPushForm] = useState(false);
  const [pushForm, setPushForm] = useState({ title: '', body: '', segment: 'all' });
  const sendPush = async () => {
    try {
      await api.sendPushNotification(pushForm.title, pushForm.body, pushForm.segment);
      setShowPushForm(false);addToast('Уведомление отправлено!', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const [showDiscForm, setShowDiscForm] = useState(false);
  const [editDisc, setEditDisc] = useState<any>(null);
  const [discForm, setDiscForm] = useState({ name: '', type: 'percent', value: 10, targetType: 'all', targetId: 0, minOrder: 0, maxDiscount: 0, activeDays: '', startsAt: '', endsAt: '', maxUses: 0 });
  const [guestSearch, setGuestSearch] = useState('');
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [guestSearching, setGuestSearching] = useState(false);
  const searchGuests = async (q: string) => {
    setGuestSearch(q);
    if (q.length < 1) { setGuestResults([]); return; }
    setGuestSearching(true);
    try { const r = await api.searchGuests(q); setGuestResults(r); } catch {} finally { setGuestSearching(false); }
  };
  const saveDisc = async () => {
    try {
      if (editDisc) await api.updateDiscount(editDisc.id, discForm);
      else await api.createDiscount(discForm);
      setShowDiscForm(false); setEditDisc(null); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const delDisc = async (id: number) => { if (!confirm('Удалить правило?')) return; try { await api.deleteDiscount(id); load(); } catch (e: any) { addToast(e.message, 'error'); } };

  const [showBonusForm, setShowBonusForm] = useState(false);
  const [bonusForm, setBonusForm] = useState({ userId: 0, amount: 100, description: '' });
  const saveBonus = async () => {
    if (!bonusForm.userId || !bonusForm.amount) return addToast('Заполните поля', 'error');
    try {
      await api.accrueBonus(bonusForm.userId, bonusForm.amount, bonusForm.description);
      setShowBonusForm(false); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState({ code: '', amount: 500, type: 'gift', recipientName: '', recipientPhone: '', message: '', expiresAt: '' });
  const saveCert = async () => {
    try {
      await api.createCertificate(certForm);
      setShowCertForm(false); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const delCert = async (id: number) => { if (!confirm('Удалить сертификат?')) return; try { await api.deleteCertificate(id); load(); } catch (e: any) { addToast(e.message, 'error'); } };

  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    if (showBonusForm) api.getUsers().then(setUsers).catch(() => {});
  }, [showBonusForm]);
  const handleBonusUserPhone = (phone: string) => {
    const u = users.find((x: any) => x.phone === phone);
    if (u) setBonusForm({ ...bonusForm, userId: u.id });
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'campaigns', label: 'Кампании', icon: Megaphone },
    { id: 'promocodes', label: 'Промокоды', icon: Ticket },
    { id: 'analytics', label: 'Аналитика', icon: BarChart4 },
    { id: 'discounts', label: 'Скидки', icon: BadgePercent },
    { id: 'bonuses', label: 'Бонусы', icon: Gift },
    { id: 'certificates', label: 'Сертификаты', icon: Award },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Маркетинг</h2>
          <p className="text-sm text-zinc-500 mt-1">Управление маркетинговыми инструментами</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === 'campaigns' && <button onClick={() => { setEditCamp(null); setCampForm({ name: '', type: 'manual', message: '', button_text: '', segment: 'all' }); setShowCampForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Кампания</button>}
          {tab === 'promocodes' && <button onClick={() => { setEditPromo(null); setPromoForm({ code: '', type: 'percent', value: 10, min_order: 0, max_uses: 100, expires_at: '' }); setShowPromoForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Промокод</button>}
          {tab === 'discounts' && <button onClick={() => { setEditDisc(null); setDiscForm({ name: '', type: 'percent', value: 10, targetType: 'all', targetId: 0, minOrder: 0, maxDiscount: 0, activeDays: '', startsAt: '', endsAt: '', maxUses: 0 }); setShowDiscForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Скидка</button>}
          {tab === 'bonuses' && <button onClick={() => { setBonusForm({ userId: 0, amount: 100, description: '' }); setShowBonusForm(true); }} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 active:scale-[0.97]"><Plus size={18} /> Начислить</button>}
          {tab === 'certificates' && <button onClick={() => { setCertForm({ code: 'GIFT-' + Math.random().toString(36).slice(2, 8).toUpperCase(), amount: 500, type: 'gift', recipientName: '', recipientPhone: '', message: '', expiresAt: '' }); setShowCertForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Сертификат</button>}
          <button onClick={() => setShowPushForm(true)} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 active:scale-[0.97]"><Send size={18} /> Push</button>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === t.id ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div className="grid gap-3">
          {campaigns.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800"><Megaphone size={48} className="mx-auto text-zinc-300 mb-4" /><p className="text-zinc-500">Нет кампаний</p></div>
          ) : campaigns.map((c: any) => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-zinc-900 dark:text-white">{c.name}</h4>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{c.message}</p>
                <div className="flex gap-3 text-[10px] text-zinc-400 mt-1">
                  <span className="flex items-center gap-1"><Send size={10} /> {c.sentCount}</span>
                  <span className="flex items-center gap-1"><Eye size={10} /> {c.openCount}</span>
                  <span className={`px-1.5 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : c.status === 'draft' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'bg-zinc-100 text-zinc-500'}`}>{c.status === 'active' ? 'Активна' : c.status === 'draft' ? 'Черновик' : 'Завершена'}</span>
                </div>
              </div>
              {c.status === 'draft' && <button onClick={() => sendCampaign(c.id)} className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Send size={16} /></button>}
            </div>
          ))}
        </div>
      )}

      {tab === 'promocodes' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr><th className="text-left p-3 text-zinc-500 font-medium text-xs">Код</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Тип</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Значение</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Мин. заказ</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Использовано</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Действует до</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {promocodes.map((p: any) => (
                  <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">{p.code}</td>
                    <td className="p-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">{p.type === 'percent' ? '%' : '₽'}</span></td>
                    <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">{p.type === 'percent' ? `${p.value}%` : `${p.value}₽`}</td>
                    <td className="p-3 text-right text-zinc-500">{p.minOrder?.toLocaleString()}₽</td>
                    <td className="p-3 text-right text-zinc-500">{p.usedCount || 0}/{p.maxUses}</td>
                    <td className="p-3 text-zinc-400 text-xs">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('ru') : '—'}</td>
                    <td className="p-3"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{p.isActive ? 'Активен' : 'Неактивен'}</span></td>
                    <td className="p-3"><div className="flex gap-1"><button onClick={() => { setEditPromo(p); setPromoForm({ code: p.code, type: p.type, value: p.value, min_order: p.minOrder, max_uses: p.maxUses, expires_at: p.expiresAt?.slice(0, 10) || '' }); setShowPromoForm(true); }} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={14} /></button><button onClick={() => delPromo(p.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm"><p className="text-xs text-zinc-500 mb-1"><Users size={14} className="inline" /> Всего пользователей</p><p className="text-2xl font-bold text-zinc-900 dark:text-white">{analytics?.totalUsers || 0}</p></div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm"><p className="text-xs text-zinc-500 mb-1"><ShoppingBag size={14} className="inline" /> Всего заказов</p><p className="text-2xl font-bold text-zinc-900 dark:text-white">{analytics?.totalOrders || 0}</p></div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm"><p className="text-xs text-zinc-500 mb-1"><Percent size={14} className="inline" /> Конверсия</p><p className="text-2xl font-bold text-green-500">{analytics?.conversionRate?.toFixed(1) || 0}%</p></div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm"><p className="text-xs text-zinc-500 mb-1"><Users size={14} className="inline" /> Активных сегодня</p><p className="text-2xl font-bold text-blue-500">{analytics?.activeToday || 0}</p></div>
        </div>
      )}

      {tab === 'discounts' && (
        <div className="space-y-3">
          {discounts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800"><BadgePercent size={48} className="mx-auto text-zinc-300 mb-4" /><p className="text-zinc-500">Нет правил скидок</p></div>
          ) : discounts.map((d: any) => (
            <div key={d.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-white">{d.name}</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  {d.type === 'percent' ? `${d.value}%` : `${d.value}₽`} •
                  {d.targetType === 'all' ? ' Весь заказ' : d.targetType === 'dish' ? ' Конкретное блюдо' : d.targetType === 'category' ? ' Категория' : d.targetType === 'day_of_week' ? ' День недели' : ' Персональная'} •
                  {d.isActive ? <span className="text-green-500 ml-1">Активна</span> : <span className="text-red-500 ml-1">Неактивна</span>}
                  {d.activeDays && <span> • Дни: {d.activeDays}</span>}
                  {d.endsAt && <span> • до {new Date(d.endsAt).toLocaleDateString('ru')}</span>}
                </p>
              </div>
              <div className="flex gap-1"><button onClick={() => { setEditDisc(d); setDiscForm({ name: d.name, type: d.type, value: d.value, targetType: d.targetType, targetId: d.targetId || 0, minOrder: d.minOrder, maxDiscount: d.maxDiscount || 0, activeDays: d.activeDays || '', startsAt: d.startsAt?.slice(0, 10) || '', endsAt: d.endsAt?.slice(0, 10) || '', maxUses: d.maxUses || 0 }); setShowDiscForm(true); }} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={14} /></button><button onClick={() => delDisc(d.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'bonuses' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <h3 className="font-bold text-zinc-900 dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-800">Бонусные счета пользователей</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr><th className="text-left p-3 text-zinc-500 font-medium text-xs">Пользователь</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Баланс</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Начислено всего</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Потрачено</th></tr>
                </thead>
                <tbody>
                  {bonuses.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-zinc-400">Нет бонусных счетов</td></tr> : bonuses.map((b: any) => (
                    <tr key={b.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3 text-zinc-900 dark:text-white font-medium">{b.userPhone || `ID: ${b.userId}`}</td>
                      <td className="p-3 text-right font-bold text-green-500">{b.balance}₽</td>
                      <td className="p-3 text-right text-zinc-500">{b.lifetimeEarned}₽</td>
                      <td className="p-3 text-right text-zinc-500">{b.lifetimeSpent}₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <h3 className="font-bold text-zinc-900 dark:text-white p-4 border-b border-zinc-100 dark:border-zinc-800">История операций</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr><th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Пользователь</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Тип</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Сумма</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Описание</th></tr>
                </thead>
                <tbody>
                  {bonusTxs.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-zinc-400">Нет операций</td></tr> : bonusTxs.map((tx: any) => (
                    <tr key={tx.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3 text-xs text-zinc-400">{new Date(tx.createdAt).toLocaleString('ru')}</td>
                      <td className="p-3 text-zinc-900 dark:text-white">{tx.userPhone || `ID: ${tx.userId}`}</td>
                      <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.type === 'earned' ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>{tx.type === 'earned' ? 'Начисление' : 'Списание'}</span></td>
                      <td className={`p-3 text-right font-bold ${tx.type === 'earned' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'earned' ? '+' : '-'}{tx.amount}₽</td>
                      <td className="p-3 text-zinc-500 text-xs">{tx.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'certificates' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr><th className="text-left p-3 text-zinc-500 font-medium text-xs">Код</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Сумма</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Остаток</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Получатель</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Срок</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {certificates.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-zinc-400">Нет сертификатов</td></tr> : certificates.map((c: any) => (
                  <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 font-mono font-bold text-zinc-900 dark:text-white">{c.code}</td>
                    <td className="p-3 text-right text-zinc-900 dark:text-white font-bold">{c.amount}₽</td>
                    <td className="p-3 text-right text-zinc-500">{c.balance}₽</td>
                    <td className="p-3 text-zinc-500 text-xs">{c.recipientName || c.recipientPhone || '—'}</td>
                    <td className="p-3"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>{c.isActive ? 'Активен' : 'Неактивен'}</span></td>
                    <td className="p-3 text-xs text-zinc-400">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('ru') : '—'}</td>
                    <td className="p-3"><button onClick={() => delCert(c.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCampForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCampForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">{editCamp ? 'Редактировать' : 'Новая'} кампания</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-zinc-500">Название</label><input value={campForm.name} onChange={e => setCampForm({...campForm, name: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Тип</label><select value={campForm.type} onChange={e => setCampForm({...campForm, type: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="manual">Ручная</option><option value="trigger">Автоматическая</option></select></div>
              <div><label className="text-xs font-medium text-zinc-500">Сообщение</label><textarea value={campForm.message} onChange={e => setCampForm({...campForm, message: e.target.value})} rows={3} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Текст кнопки</label><input value={campForm.button_text} onChange={e => setCampForm({...campForm, button_text: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Сегмент</label><select value={campForm.segment} onChange={e => setCampForm({...campForm, segment: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="all">Все</option><option value="active">Активные</option><option value="inactive">Неактивные</option></select></div>
              <button onClick={saveCamp} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">{editCamp ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {showPromoForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPromoForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">{editPromo ? 'Редактировать' : 'Новый'} промокод</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Код</label><div className="flex gap-2 mt-1"><input value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} className="flex-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /><button type="button" onClick={() => generateCode((code) => setPromoForm({...promoForm, code}))} className="px-3 py-2.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-[0.97]">Ген</button></div></div>
                <div><label className="text-xs font-medium text-zinc-500">Тип кода</label><div className="flex gap-2 mt-1"><select value={genType} onChange={e => setGenType(e.target.value)} className="flex-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="all">A-Z+0-9</option><option value="letters">Только буквы</option><option value="digits">Только цифры</option></select><input type="number" value={genLen || ''} onChange={e => setGenLen(e.target.value === '' ? 0 : Number(e.target.value))} min={4} max={32} className="w-16 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center" /></div></div>
              </div>
              <div><label className="text-xs font-medium text-zinc-500">Тип</label><select value={promoForm.type} onChange={e => setPromoForm({...promoForm, type: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="percent">%</option><option value="fixed">₽</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Значение</label><input type="number" value={promoForm.value || ''} onChange={e => setPromoForm({...promoForm, value: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Мин. заказ</label><input type="number" value={promoForm.min_order || ''} onChange={e => setPromoForm({...promoForm, min_order: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Макс. использований</label><input type="number" value={promoForm.max_uses || ''} onChange={e => setPromoForm({...promoForm, max_uses: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Действует до</label><input type="date" value={promoForm.expires_at} onChange={e => setPromoForm({...promoForm, expires_at: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <button onClick={savePromo} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">{editPromo ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {showPushForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPushForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Отправить push-уведомление</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-zinc-500">Заголовок</label><input value={pushForm.title} onChange={e => setPushForm({...pushForm, title: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Текст</label><textarea value={pushForm.body} onChange={e => setPushForm({...pushForm, body: e.target.value})} rows={3} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Получатели</label><select value={pushForm.segment} onChange={e => setPushForm({...pushForm, segment: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="all">Все пользователи</option><option value="active">Активные</option></select></div>
              <button onClick={sendPush} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-orange-600 active:scale-[0.97]">Отправить</button>
            </div>
          </div>
        </div>
      )}

      {showDiscForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDiscForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">{editDisc ? 'Редактировать' : 'Новое'} правило скидки</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-zinc-500">Название</label><input value={discForm.name} onChange={e => setDiscForm({...discForm, name: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Тип</label><select value={discForm.type} onChange={e => setDiscForm({...discForm, type: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="percent">Процент</option><option value="fixed">Фикс</option></select></div>
                <div><label className="text-xs font-medium text-zinc-500">Значение</label><input type="number" value={discForm.value || ''} onChange={e => setDiscForm({...discForm, value: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div><label className="text-xs font-medium text-zinc-500">Применяется к</label><select value={discForm.targetType} onChange={e => setDiscForm({...discForm, targetType: e.target.value, targetId: 0})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="all">Всему заказу</option><option value="dish">Конкретному блюду</option><option value="category">Категории</option><option value="day_of_week">Дню недели</option><option value="personal">Персональная</option></select></div>
              {discForm.targetType === 'personal' && (
                <div className="relative">
                  <label className="text-xs font-medium text-zinc-500">Гость</label>
                  <input value={guestSearch} onChange={e => searchGuests(e.target.value)} placeholder="Введите имя или телефон..." className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                  {guestSearch.length > 0 && guestResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {guestResults.map(g => (
                        <button key={g.id} type="button" onClick={() => { setDiscForm({...discForm, targetId: g.id}); setGuestSearch(`${g.name} (${g.phone})`); setGuestResults([]); }}
                          className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700">{g.name} — {g.phone}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Мин. сумма заказа</label><input type="number" value={discForm.minOrder || ''} onChange={e => setDiscForm({...discForm, minOrder: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Макс. скидка</label><input type="number" value={discForm.maxDiscount || ''} onChange={e => setDiscForm({...discForm, maxDiscount: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Дни недели (1234567)</label><input value={discForm.activeDays} onChange={e => setDiscForm({...discForm, activeDays: e.target.value})} placeholder="1234567" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Макс. использований</label><input type="number" value={discForm.maxUses || ''} onChange={e => setDiscForm({...discForm, maxUses: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Начало</label><input type="date" value={discForm.startsAt} onChange={e => setDiscForm({...discForm, startsAt: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Окончание</label><input type="date" value={discForm.endsAt} onChange={e => setDiscForm({...discForm, endsAt: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <button onClick={saveDisc} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">{editDisc ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {showBonusForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowBonusForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Начислить бонусы</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-zinc-500">Телефон пользователя</label>
                <input list="usersList" value={bonusForm.userId ? users.find((u: any) => u.id === bonusForm.userId)?.phone || '' : ''} onChange={e => handleBonusUserPhone(e.target.value)} placeholder="Введите телефон" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                <datalist id="usersList">{users.map((u: any) => <option key={u.id} value={u.phone} />)}</datalist>
              </div>
              <div><label className="text-xs font-medium text-zinc-500">Сумма (₽)</label><input type="number" value={bonusForm.amount || ''} onChange={e => setBonusForm({...bonusForm, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div><label className="text-xs font-medium text-zinc-500">Описание</label><input value={bonusForm.description} onChange={e => setBonusForm({...bonusForm, description: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <button onClick={saveBonus} className="w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-green-600 active:scale-[0.97]">Начислить</button>
            </div>
          </div>
        </div>
      )}

      {showCertForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCertForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Новый сертификат</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Код</label><div className="flex gap-2 mt-1"><input value={certForm.code} onChange={e => setCertForm({...certForm, code: e.target.value.toUpperCase()})} className="flex-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /><button type="button" onClick={() => generateCode((code) => setCertForm({...certForm, code}))} className="px-3 py-2.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-[0.97]">Ген</button></div></div>
                <div><label className="text-xs font-medium text-zinc-500">Сумма (₽)</label><input type="number" value={certForm.amount || ''} onChange={e => setCertForm({...certForm, amount: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Имя получателя</label><input value={certForm.recipientName} onChange={e => setCertForm({...certForm, recipientName: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Телефон</label><input value={certForm.recipientPhone} onChange={e => setCertForm({...certForm, recipientPhone: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div><label className="text-xs font-medium text-zinc-500">Сообщение</label><textarea value={certForm.message} onChange={e => setCertForm({...certForm, message: e.target.value})} rows={2} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Срок действия</label><input type="date" value={certForm.expiresAt} onChange={e => setCertForm({...certForm, expiresAt: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Тип</label><select value={certForm.type} onChange={e => setCertForm({...certForm, type: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"><option value="gift">Подарочный</option><option value="discount">Скидочный</option></select></div>
              </div>
              <button onClick={saveCert} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
