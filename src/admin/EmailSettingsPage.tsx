import { useState, useEffect } from 'react';
import { Mail, Save, Send, RefreshCw, Plus, Pencil, Trash2, Eye, BarChart3, LayoutTemplate, Settings } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function EmailSettingsPage() {
  const [tab, setTab] = useState<'smtp' | 'templates' | 'stats'>('smtp');
  const [settings, setSettings] = useState<any>({ enabled: false, host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body_html: '', variables: '[]' });
  const [stats, setStats] = useState<any>({ total: 0, sent: 0, failed: 0, opened: 0, openRate: 0, recent: [] });

  useEffect(() => {
    api.getEmailSettings().then(setSettings).catch(() => {});
    if (tab === 'templates') loadTemplates();
    if (tab === 'stats') loadStats();
  }, [tab]);

  const loadTemplates = async () => {
    try { setTemplates(await api.get('/api/email/templates')); } catch {}
  };

  const loadStats = async () => {
    try { setStats(await api.get('/api/email/stats')); } catch {}
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveEmailSettings(settings);
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.testEmailConnection();
      addToast(res.success ? 'Подключение работает' : res.error, res.success ? 'success' : 'error');
    } catch (e: any) { addToast(e.message, 'error'); }
    setTesting(false);
  };

  const sendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    try {
      const res = await api.sendTestEmail(testEmail, 'Тестовое письмо FoodChain', '<h1>Тест</h1><p>Если вы видите это письмо — SMTP работает!</p>');
      addToast(res.success ? 'Письмо отправлено' : res.error, res.success ? 'success' : 'error');
    } catch (e: any) { addToast(e.message, 'error'); }
    setSending(false);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', subject: '', body_html: '', variables: '[]' });
    setShowTemplateForm(true);
  };

  const openEditTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTemplateForm({ name: tpl.name, subject: tpl.subject, body_html: tpl.body_html || '', variables: tpl.variables || '[]' });
    setShowTemplateForm(true);
  };

  const saveTemplate = async () => {
    try {
      if (editingTemplate) {
        await api.put(`/api/email/templates/${editingTemplate.id}`, templateForm);
      } else {
        await api.post('/api/email/templates', templateForm);
      }
      addToast('Шаблон сохранён', 'success');
      setShowTemplateForm(false);
      loadTemplates();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await api.del(`/api/email/templates/${id}`);
      addToast('Шаблон удалён', 'success');
      loadTemplates();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const tabs = [
    { key: 'smtp', label: 'Настройки SMTP', icon: Settings },
    { key: 'templates', label: 'Шаблоны', icon: LayoutTemplate },
    { key: 'stats', label: 'Статистика', icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
          <Mail size={22} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">E-mail настройки</h1>
          <p className="text-sm text-zinc-500">Управление email-рассылками</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'smtp' && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm space-y-5">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} className="rounded" />
              <span className="text-sm font-medium">Включить отправку e-mail</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">SMTP Хост</label>
                <input type="text" value={settings.host} onChange={e => setSettings({ ...settings, host: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="smtp.example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Порт</label>
                <input type="number" value={settings.port} onChange={e => setSettings({ ...settings, port: Number(e.target.value) })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Имя пользователя</label>
                <input type="text" value={settings.user} onChange={e => setSettings({ ...settings, user: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Пароль</label>
                <input type="password" value={settings.pass} onChange={e => setSettings({ ...settings, pass: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">From (от кого)</label>
                <input type="text" value={settings.from} onChange={e => setSettings({ ...settings, from: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="noreply@example.com" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.secure} onChange={e => setSettings({ ...settings, secure: e.target.checked })} className="rounded" />
                  <span className="text-sm">SSL/TLS</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:bg-zinc-400">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Сохранить
              </button>
              <button onClick={test} disabled={testing} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-5 py-2.5 rounded-xl text-sm font-medium transition">
                {testing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Проверить подключение
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold">Отправить тестовое письмо</h2>
            <div className="flex items-center gap-3">
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm" placeholder="test@example.com" />
              <button onClick={sendTest} disabled={sending || !testEmail} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:bg-zinc-400">
                {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                Отправить
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'templates' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Шаблоны писем</h2>
            <button onClick={openNewTemplate} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} />
              Создать шаблон
            </button>
          </div>
          {!showTemplateForm ? (
            <div className="space-y-2">
              {templates.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{tpl.name}</p>
                    <p className="text-xs text-zinc-400">{tpl.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditTemplate(tpl)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition">
                      <Pencil size={15} />
                    </button>
                    {!tpl.is_system && (
                      <button onClick={() => deleteTemplate(tpl.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition text-red-500">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-zinc-400 text-center py-4">Нет шаблонов</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input type="text" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Тема письма</label>
                <input type="text" value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">HTML тело письма</label>
                <textarea value={templateForm.body_html} onChange={e => setTemplateForm({ ...templateForm, body_html: e.target.value })} rows={8}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1 font-mono" placeholder="<h1>Привет, {name}!</h1>" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Переменные (JSON)</label>
                <input type="text" value={templateForm.variables} onChange={e => setTemplateForm({ ...templateForm, variables: e.target.value })} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1 font-mono" placeholder='["name", "order_id"]' />
              </div>
              <div className="flex gap-3">
                <button onClick={saveTemplate} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
                  <Save size={16} className="inline mr-1" />
                  Сохранить шаблон
                </button>
                <button onClick={() => setShowTemplateForm(false)} className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-5 py-2.5 rounded-xl text-sm font-medium transition">
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Всего отправлено</p>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Доставлено</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.sent}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Ошибки</p>
              <p className="text-3xl font-bold text-red-500">{stats.failed}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Open Rate</p>
              <p className="text-3xl font-bold text-blue-600">{stats.openRate}%</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-4">Последние отправки</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-2 font-medium">Получатель</th>
                    <th className="pb-2 font-medium">Тема</th>
                    <th className="pb-2 font-medium">Статус</th>
                    <th className="pb-2 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((log: any, i: number) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">{log.recipient}</td>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">{log.subject}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {log.status === 'sent' ? 'Доставлено' : 'Ошибка'}
                        </span>
                      </td>
                      <td className="py-2 text-zinc-400 text-xs">{log.sent_at}</td>
                    </tr>
                  ))}
                  {stats.recent.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-zinc-400">Нет отправок</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
