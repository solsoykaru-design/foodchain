import { useState, useEffect, useCallback } from 'react';
import { Wallet, BookOpen, FileText, Plus, Pencil, Trash2, AlertCircle, Check, X, ArrowUpDown, List, Eye, RotateCcw } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Актив', icon: '🏦' },
  { value: 'liability', label: 'Пассив', icon: '💳' },
  { value: 'equity', label: 'Капитал', icon: '📊' },
  { value: 'income', label: 'Доход', icon: '📈' },
  { value: 'expense', label: 'Расход', icon: '📉' },
];

const typeIcon = (type: string) => {
  const t = ACCOUNT_TYPES.find(a => a.value === type);
  return t ? t.icon : '📋';
};

const typeLabel = (type: string) => {
  const t = ACCOUNT_TYPES.find(a => a.value === type);
  return t ? t.label : type;
};

export default function BalanceSheetPage() {
  const [tab, setTab] = useState<'accounts' | 'entries' | 'balance'>('accounts');

  // ─── Accounts State ────────────────────────────────────────
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset', parent_id: '', description: '' });

  // ─── Journal Entries State ────────────────────────────────
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entryFilterFrom, setEntryFilterFrom] = useState('');
  const [entryFilterTo, setEntryFilterTo] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), description: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }] });
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  // ─── Balance Sheet State ───────────────────────────────────
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [balanceData, setBalanceData] = useState<any>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ─── Data Loaders ─────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    setAccountsLoading(false);
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const data = await api.getJournalEntries({
        from: entryFilterFrom || undefined,
        to: entryFilterTo || undefined,
      });
      setEntries(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    setEntriesLoading(false);
  }, [entryFilterFrom, entryFilterTo]);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const data = await api.getBalanceSheet({ date: balanceDate || undefined });
      setBalanceData(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    setBalanceLoading(false);
  }, [balanceDate]);

  useEffect(() => { if (tab === 'accounts') loadAccounts(); }, [tab, loadAccounts]);
  useEffect(() => { if (tab === 'entries') loadEntries(); }, [tab, loadEntries]);
  useEffect(() => { if (tab === 'balance') loadBalance(); }, [tab, loadBalance]);

  // ─── Account CRUD ─────────────────────────────────────────
  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({ code: '', name: '', type: 'asset', parent_id: '', description: '' });
    setShowAccountModal(true);
  };

  const openEditAccount = (acc: any) => {
    setEditingAccount(acc);
    setAccountForm({
      code: acc.code || '',
      name: acc.name || '',
      type: acc.type || 'asset',
      parent_id: acc.parent_id ? String(acc.parent_id) : '',
      description: acc.description || '',
    });
    setShowAccountModal(true);
  };

  const saveAccount = async () => {
    if (!accountForm.code || !accountForm.name) { addToast('Код и наименование обязательны', 'error'); return; }
    const payload = {
      code: accountForm.code,
      name: accountForm.name,
      type: accountForm.type,
      parent_id: accountForm.parent_id ? Number(accountForm.parent_id) : undefined,
      description: accountForm.description || undefined,
    };
    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, payload);
        addToast('Счёт обновлён', 'success');
      } else {
        await api.createAccount(payload);
        addToast('Счёт создан', 'success');
      }
      setShowAccountModal(false);
      loadAccounts();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteAccount = async (id: number) => {
    if (!confirm('Удалить счёт?')) return;
    try {
      await api.deleteAccount(id);
      addToast('Счёт удалён', 'success');
      loadAccounts();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  // ─── Journal Entry CRUD ───────────────────────────────────
  const addLine = () => {
    setEntryForm(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }));
  };

  const removeLine = (idx: number) => {
    setEntryForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  };

  const updateLine = (idx: number, field: string, value: string) => {
    setEntryForm(f => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...f, lines };
    });
  };

  const saveEntry = async () => {
    if (!entryForm.entry_date) { addToast('Дата обязательна', 'error'); return; }
    const validLines = entryForm.lines.filter(l => l.account_id);
    if (validLines.length < 2) { addToast('Нужно минимум 2 строки (дебет/кредит)', 'error'); return; }

    const totalDebit = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      addToast(`Дебет (${totalDebit.toFixed(2)}) ≠ Кредит (${totalCredit.toFixed(2)})`, 'error');
      return;
    }

    try {
      await api.createJournalEntry({
        entry_date: entryForm.entry_date,
        description: entryForm.description || undefined,
        lines: validLines.map(l => ({
          account_id: Number(l.account_id),
          debit: l.debit ? parseFloat(l.debit) : undefined,
          credit: l.credit ? parseFloat(l.credit) : undefined,
          description: l.description || undefined,
        })),
      });
      addToast('Проводка создана', 'success');
      setShowEntryModal(false);
      setEntryForm({ entry_date: new Date().toISOString().slice(0, 10), description: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }] });
      loadEntries();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const toggleExpandEntry = (id: number) => {
    setExpandedEntry(expandedEntry === id ? null : id);
  };

  // ─── Balance Sheet helpers ────────────────────────────────
  const getSectionAccounts = (section: string) => {
    if (!balanceData?.sections) return [];
    return balanceData.sections.filter((s: any) => s.section === section);
  };

  const calculateTotal = (accounts: any[]) => {
    return accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0);
  };

  // ─── Render ───────────────────────────────────────────────
  const tabs = [
    { id: 'accounts' as const, icon: BookOpen, label: 'План счетов' },
    { id: 'entries' as const, icon: List, label: 'Журнал проводок' },
    { id: 'balance' as const, icon: FileText, label: 'Баланс' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <Wallet size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Бухгалтерский баланс</h1>
          <p className="text-sm text-zinc-500">Двойная запись, план счетов, оборотно-сальдовая ведомость</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Chart of Accounts ───────────────────────── */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-zinc-500">Всего счетов: {accounts.length}</p>
            <button onClick={openNewAccount}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} />
              Новый счёт
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-sm">
            {accountsLoading ? (
              <div className="text-center py-12 text-zinc-400">Загрузка...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">Нет счетов</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Код</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Наименование</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Тип</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Родительский счёт</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Описание</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc: any) => (
                      <tr key={acc.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2.5 font-mono text-xs">{acc.code}</td>
                        <td className="px-3 py-2.5 font-medium">{acc.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                            {typeIcon(acc.type)} {typeLabel(acc.type)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">{acc.parent_name || '—'}</td>
                        <td className="px-3 py-2.5 text-zinc-500 max-w-[200px] truncate">{acc.description || '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditAccount(acc)}
                              className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteAccount(acc.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 2: Journal Entries ──────────────────────────── */}
      {tab === 'entries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">С:</label>
              <input type="date" value={entryFilterFrom} onChange={e => setEntryFilterFrom(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">По:</label>
              <input type="date" value={entryFilterTo} onChange={e => setEntryFilterTo(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm outline-none" />
            </div>
            <button onClick={loadEntries}
              className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm transition">
              <RotateCcw size={14} />
              Обновить
            </button>
            <div className="flex-1" />
            <button onClick={() => { setShowEntryModal(true); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} />
              Новая проводка
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-sm">
            {entriesLoading ? (
              <div className="text-center py-12 text-zinc-400">Загрузка...</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">Нет проводок</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Дата</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Описание</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">Дебет</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">Кредит</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-zinc-500">Строк</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any) => {
                      const lines = entry.lines || [];
                      const debitTotal = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
                      const creditTotal = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
                      const isExpanded = expandedEntry === entry.id;
                      return (
                        <tr key={entry.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-3 py-2.5 text-xs">{entry.entry_date?.slice(0, 10)}</td>
                          <td className="px-3 py-2.5 max-w-[300px] truncate">{entry.description || '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">{debitTotal.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">{creditTotal.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => toggleExpandEntry(entry.id)}
                              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition">
                              <Eye size={14} />
                              {lines.length}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {isExpanded && lines.length > 0 && (
                              <div className="absolute right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-3 z-10 min-w-[400px]">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                      <th className="text-left px-2 py-1 text-zinc-500">Счёт</th>
                                      <th className="text-right px-2 py-1 text-zinc-500">Дебет</th>
                                      <th className="text-right px-2 py-1 text-zinc-500">Кредит</th>
                                      <th className="text-left px-2 py-1 text-zinc-500">Описание</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((l: any, i: number) => (
                                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-700/50">
                                        <td className="px-2 py-1.5 font-medium">{l.account_name || l.account_id}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{l.debit ? l.debit.toFixed(2) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{l.credit ? l.credit.toFixed(2) : '—'}</td>
                                        <td className="px-2 py-1.5 text-zinc-500">{l.description || ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 3: Balance Sheet ────────────────────────────── */}
      {tab === 'balance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">Дата:</label>
              <input type="date" value={balanceDate} onChange={e => setBalanceDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm outline-none" />
            </div>
            <button onClick={loadBalance}
              className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm transition">
              <RotateCcw size={14} />
              Обновить
            </button>
          </div>

          {balanceLoading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-zinc-400">Загрузка...</p>
            </div>
          ) : balanceData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* АКТИВЫ */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  АКТИВЫ
                </h2>

                {['non_current', 'current'].map(sectionKey => {
                  const sectionAccounts = getSectionAccounts(sectionKey);
                  if (sectionAccounts.length === 0) return null;
                  const sectionLabel = sectionKey === 'non_current' ? 'Внеоборотные активы' : 'Оборотные активы';
                  const total = calculateTotal(sectionAccounts);
                  return (
                    <div key={sectionKey} className="mb-4">
                      <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        {sectionLabel}
                      </h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Код</th>
                            <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Наименование</th>
                            <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Сальдо</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionAccounts.map((a: any) => (
                            <tr key={a.id || a.code} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="px-2 py-1.5 font-mono text-xs">{a.code}</td>
                              <td className="px-2 py-1.5">{a.name}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-xs font-medium">
                                {a.balance ? a.balance.toFixed(2) : '0.00'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-zinc-300 dark:border-zinc-600">
                            <td colSpan={2} className="px-2 py-2 text-sm font-bold text-right">Итого:</td>
                            <td className="px-2 py-2 text-right font-mono text-sm font-bold text-blue-600">{total.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}

                <div className="mt-4 pt-4 border-t-2 border-blue-500">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">ИТОГО АКТИВЫ</span>
                    <span className="text-base font-bold font-mono text-blue-600">
                      {balanceData.total_assets?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ПАССИВЫ */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full" />
                  ПАССИВЫ
                </h2>

                {['equity', 'long_term', 'short_term'].map(sectionKey => {
                  const sectionAccounts = getSectionAccounts(sectionKey);
                  if (sectionAccounts.length === 0) return null;
                  const sectionLabel = sectionKey === 'equity' ? 'Капитал и резервы' : sectionKey === 'long_term' ? 'Долгосрочные обязательства' : 'Краткосрочные обязательства';
                  const total = calculateTotal(sectionAccounts);
                  return (
                    <div key={sectionKey} className="mb-4">
                      <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                        {sectionLabel}
                      </h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Код</th>
                            <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Наименование</th>
                            <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Сальдо</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionAccounts.map((a: any) => (
                            <tr key={a.id || a.code} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="px-2 py-1.5 font-mono text-xs">{a.code}</td>
                              <td className="px-2 py-1.5">{a.name}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-xs font-medium">
                                {a.balance ? a.balance.toFixed(2) : '0.00'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-zinc-300 dark:border-zinc-600">
                            <td colSpan={2} className="px-2 py-2 text-sm font-bold text-right">Итого:</td>
                            <td className="px-2 py-2 text-right font-mono text-sm font-bold text-emerald-600">{total.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}

                <div className="mt-4 pt-4 border-t-2 border-emerald-500">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">ИТОГО ПАССИВЫ</span>
                    <span className="text-base font-bold font-mono text-emerald-600">
                      {balanceData.total_liabilities?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance check */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Активы = Пассивы:</span>
                    <span className="font-mono font-bold text-lg">
                      {balanceData.total_assets?.toFixed(2)} = {balanceData.total_liabilities?.toFixed(2)}
                    </span>
                    {Math.abs((balanceData.total_assets || 0) - (balanceData.total_liabilities || 0)) < 0.01 ? (
                      <Check size={20} className="text-emerald-500" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={20} className="text-red-500" />
                        <span className="text-sm text-red-500 font-medium">
                          Разница: {((balanceData.total_assets || 0) - (balanceData.total_liabilities || 0)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-zinc-400">Выберите дату и нажмите "Обновить"</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Account Modal ────────────────────────────────── */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAccountModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingAccount ? 'Редактировать счёт' : 'Новый счёт'}
              </h2>
              <button onClick={() => setShowAccountModal(false)} className="p-1 text-zinc-400 hover:text-zinc-600 transition">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Код *</label>
                  <input type="text" value={accountForm.code} onChange={e => setAccountForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Тип</label>
                  <select value={accountForm.type} onChange={e => setAccountForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500">
                    {ACCOUNT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Наименование *</label>
                <input type="text" value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Основные средства" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Родительский счёт</label>
                  <select value={accountForm.parent_id} onChange={e => setAccountForm(f => ({ ...f, parent_id: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500">
                    <option value="">— Нет —</option>
                    {accounts.filter(a => !editingAccount || a.id !== editingAccount.id).map(a => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Описание</label>
                  <input type="text" value={accountForm.description} onChange={e => setAccountForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Описание счёта" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">
                  Отмена
                </button>
                <button onClick={saveAccount}
                  className="px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition">
                  {editingAccount ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Journal Entry Modal ──────────────────────────── */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEntryModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Новая проводка</h2>
              <button onClick={() => setShowEntryModal(false)} className="p-1 text-zinc-400 hover:text-zinc-600 transition">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Дата *</label>
                  <input type="date" value={entryForm.entry_date} onChange={e => setEntryForm(f => ({ ...f, entry_date: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Описание</label>
                  <input type="text" value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder="Хозяйственная операция" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-500">Строки проводки</label>
                  <button onClick={addLine}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition">
                    <Plus size={14} />
                    Добавить строку
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Счёт *</th>
                        <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Дебет</th>
                        <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Кредит</th>
                        <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Описание</th>
                        <th className="text-center px-2 py-1.5 text-xs font-medium text-zinc-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryForm.lines.map((line, idx) => (
                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-2 py-1.5">
                            <select value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500">
                              <option value="">Выберите счёт</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-emerald-500" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-emerald-500" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removeLine(idx)}
                              className="p-1 text-zinc-400 hover:text-red-500 transition">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 dark:border-zinc-600">
                        <td className="px-2 py-2 text-xs font-bold text-right">Итого:</td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-bold">
                          {entryForm.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-bold">
                          {entryForm.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">
                  Отмена
                </button>
                <button onClick={saveEntry}
                  className="px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition">
                  Создать проводку
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
