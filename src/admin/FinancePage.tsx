import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { useTranslation } from 'react-i18next';
import { DollarSign, TrendingUp, TrendingDown, Download, CalendarDays, CreditCard, Wallet, Building2, Plus, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function FinancePage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<'revenue' | 'expenses' | 'profit'>('revenue');
  const [showAddTx, setShowAddTx] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'expense', category: 'other', amount: 0, description: '', payment_method: 'cash' });

  const load = async () => {
    try {
      const [s, tx] = await Promise.all([api.getFinanceSummary(from, to), api.getFinanceTransactions({ from, to })]);
      setSummary(s);
      setTransactions(tx);
    } catch {}
  };

  useEffect(() => { load(); }, [from, to]);

  const addTransaction = async () => {
    try {
      await api.createFinanceTransaction({ ...txForm, date: new Date().toISOString().slice(0, 10) });
      setShowAddTx(false);
      setTxForm({ type: 'expense', category: 'other', amount: 0, description: '', payment_method: 'cash' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const exportCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(item => columns.map(c => `"${String(item[c.key] ?? '')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFinance = () => {
    const columns = [
      { key: 'date', label: 'Дата' },
      { key: 'type', label: 'Тип' },
      { key: 'category', label: 'Категория' },
      { key: 'description', label: 'Описание' },
      { key: 'paymentMethod', label: 'Метод' },
      { key: 'amount', label: 'Сумма' },
    ];
    exportCSV(transactions, `finance_${from}_${to}.csv`, columns);
  };

  const revenueData = summary?.revenueByDay?.slice(-14).map((d: any) => ({
    name: new Date(d.date).toLocaleDateString('ru', { day: 'numeric', month: 'short' }),
    revenue: d.revenue,
    orders: d.orders,
  })) || [];

  const expenses = transactions.filter(t => t.type === 'expense');
  const incomes = transactions.filter(t => t.type === 'income');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('sidebar_finance')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t('finance_summary')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
          <span className="text-zinc-400">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
          <button onClick={() => setShowAddTx(true)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97] transition-all"><Plus size={16} /> {t('finance_add')}</button>
          <button onClick={handleExportFinance}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 active:scale-[0.97] transition-all"><Download size={16} /> {t('finance_export_csv')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">{t('finance_revenue')}</p>
          <p className="text-2xl font-bold text-green-500">{summary?.totalRevenue?.toLocaleString() || 0}₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">{t('finance_expenses')}</p>
          <p className="text-2xl font-bold text-red-500">{summary?.totalExpenses?.toLocaleString() || 0}₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">{t('finance_net_profit')}</p>
          <p className={`text-2xl font-bold ${(summary?.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{summary?.netProfit?.toLocaleString() || 0}₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 mb-1">{t('finance_orders_count')}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{summary?.ordersCount || 0}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit">
        {(['revenue', 'expenses', 'profit'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-4 py-2 rounded-lg font-medium transition ${tab === tabKey ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
            {tabKey === 'revenue' ? t('finance_tab_revenue') : tabKey === 'expenses' ? t('finance_tab_expenses') : t('finance_tab_profit')}
          </button>
        ))}
      </div>

      {tab === 'revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t('finance_revenue_by_day')}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                <Bar dataKey="revenue" fill="#22c55e" radius={[6, 6, 0, 0]} name="Выручка" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t('finance_by_payment')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={summary?.byPaymentMethod?.map((p: any) => ({ name: p.paymentMethod || 'Другое', value: p.total })) || []}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {(summary?.byPaymentMethod || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-3">
              {(summary?.byPaymentMethod || []).map((p: any, i: number) => (
                <div key={p.paymentMethod} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-zinc-600 dark:text-zinc-400">{p.paymentMethod === 'cash' ? t('finance_cash') : p.paymentMethod === 'card' ? t('finance_card') : t('finance_online')}</span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white">{p.total?.toLocaleString()}₽</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-white">{t('finance_expenses')}</h3>
          </div>
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">{t('finance_no_expenses')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_date')}</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_category')}</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_description')}</th>
                    <th className="text-right p-3 text-zinc-500 font-medium text-xs">{t('finance_amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((tx: any) => (
                    <tr key={tx.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3 text-zinc-400 text-xs">{tx.date || (tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('ru') : '')}</td>
                      <td className="p-3"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{tx.category === 'salary' ? t('finance_category_salary') : tx.category === 'purchase' ? t('finance_category_purchase') : tx.category === 'delivery' ? t('finance_category_delivery') : tx.category === 'rent' ? t('finance_category_rent') : tx.category || t('finance_category_other')}</span></td>
                      <td className="p-3 text-zinc-600 dark:text-zinc-400">{tx.description || '—'}</td>
                      <td className="p-3 text-right font-bold text-red-500">-{tx.amount?.toLocaleString()}₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'profit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t('finance_dynamic_profit')}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Прибыль" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t('finance_total')}</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('finance_revenue')}</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{summary?.totalRevenue?.toLocaleString() || 0}₽</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">{t('finance_expenses')}</span>
                <span className="text-xl font-bold text-red-600 dark:text-red-400">{summary?.totalExpenses?.toLocaleString() || 0}₽</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('finance_net_profit')}</span>
                <span className={`text-xl font-bold ${(summary?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{summary?.netProfit?.toLocaleString() || 0}₽</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white">{t('finance_all_operations')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_date')}</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_type')}</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_category')}</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_description')}</th>
                <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('finance_method')}</th>
                <th className="text-right p-3 text-zinc-500 font-medium text-xs">{t('finance_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3 text-zinc-400 text-xs">{tx.date || (tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('ru') : '')}</td>
                  <td className="p-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {tx.type === 'income' ? t('finance_income') : t('finance_expense')}
                    </span>
                  </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{tx.category === 'order' ? t('finance_category_order') : tx.category === 'salary' ? t('finance_category_salary') : tx.category === 'purchase' ? t('finance_category_purchase') : tx.category === 'delivery' ? t('finance_category_delivery') : tx.category === 'rent' ? t('finance_category_rent') : tx.category || '—'}</td>
                  <td className="p-3 text-zinc-600 dark:text-zinc-400">{tx.description || '—'}</td>
                    <td className="p-3 text-zinc-500 text-xs">{tx.paymentMethod === 'cash' ? t('finance_cash') : tx.paymentMethod === 'card' ? t('finance_card') : tx.paymentMethod === 'online' ? t('finance_online') : '—'}</td>
                  <td className={`p-3 text-right font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'income' ? '+' : '-'}{tx.amount?.toLocaleString()}₽</td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-zinc-400">{t('finance_no_operations')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAddTx && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddTx(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('finance_add_operation')}</h3>
              <button onClick={() => setShowAddTx(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">{t('finance_type')}</label>
                  <select value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <option value="income">{t('finance_income')}</option><option value="expense">{t('finance_expense')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">{t('finance_category')}</label>
                  <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <option value="order">{t('finance_category_order')}</option><option value="salary">{t('finance_category_salary')}</option>
                    <option value="purchase">{t('finance_category_purchase')}</option><option value="delivery">{t('finance_category_delivery')}</option>
                    <option value="rent">{t('finance_category_rent')}</option><option value="other">{t('finance_category_other')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('finance_amount')}</label>
                <input type="number" value={txForm.amount || ''} onChange={e => setTxForm({...txForm, amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('finance_description')}</label>
                <input value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <button onClick={addTransaction}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">{t('finance_add')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
