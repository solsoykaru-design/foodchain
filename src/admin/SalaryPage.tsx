import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { DollarSign, TrendingUp, Users, BarChart3, Calculator, Wallet, UserPlus, Download, Eye, Settings2, Clock, Award, FileSpreadsheet } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  courier: 'Курьер', waiter: 'Официант', chef: 'Повар', kitchen: 'Повар', admin: 'Администратор',
  manager: 'Управляющий', stock_manager: 'Кладовщик', barmen: 'Бармен',
};

const ROLE_OPTIONS = ['courier', 'waiter', 'chef', 'kitchen', 'admin', 'manager', 'stock_manager', 'barmen'];

const METRIC_LABELS: Record<string, string> = {
  orders_delivered: 'Доставлено заказов',
  sales_amount: 'Сумма продаж',
  shifts_count: 'Отработано смен',
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  salary: 'Оклад', per_order: 'За заказы', per_km: 'За км', hourly: 'Почасовая',
};

const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function SalaryPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'salary' | 'settings' | 'timesheet' | 'kpi'>('salary');
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<{salary: any; staff: any} | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<{staffId: number; name: string} | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<{record: any; staff: any} | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, paid_date: '', payment_method: 'cash', note: '' });
  const [history, setHistory] = useState<{salary: any[]; log: any[]}>({ salary: [], log: [] });
  const [payrollSettings, setPayrollSettings] = useState<any>({});
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [kpiBonuses, setKpiBonuses] = useState<any[]>([]);
  const [timesheetForm, setTimesheetForm] = useState({ staff_id: '', date: '', start_time: '', end_time: '', break_minutes: 0, note: '' });
  const [kpiForm, setKpiForm] = useState({ name: '', role: 'all', metric: 'orders_delivered', threshold: 0, bonus_amount: 0 });
  const [addForm, setAddForm] = useState<any>({ first_name: '', last_name: '', role: 'courier', phone: '', email: '', password: '', username: '', salary_types: [] as string[], salary_values: {} as Record<string, number> });

  const loadData = async () => {
    setLoading(true);
    try {
      const [records, rep, staff, settings, ts, kpi] = await Promise.all([
        api.getSalary({ month, year }),
        api.getSalaryReport(month, year),
        api.getStaff(),
        api.getPayrollSettings(),
        api.getTimesheet({ month, year }),
        api.getKpiBonuses(),
      ]);
      setSalaryRecords(records);
      setReport(rep);
      setStaffList(staff);
      setPayrollSettings(settings);
      setTimesheet(ts);
      setKpiBonuses(kpi);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [month, year]);

  const calculateAll = async () => {
    setCalcLoading(true);
    try {
      await api.calculateSalary({ all: true, month, year });
      await loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
    setCalcLoading(false);
    setShowCalcModal(false);
  };

  const calculateOne = async (staffId: number) => {
    try {
      await api.calculateSalary({ staff_id: staffId, month, year });
      await loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openPay = (record: any) => {
    const staff = staffList.find(s => s.id === record.staffId);
    setShowPayModal({ salary: record, staff });
    setPayForm({ amount: (record.netAmount || record.accruedAmount) - (record.paidAmount || 0), paid_date: new Date().toISOString().split('T')[0], payment_method: 'cash', note: '' });
  };

  const confirmPay = async () => {
    if (!showPayModal) return;
    try {
      await api.paySalary({ salary_id: showPayModal.salary.id, staff_id: showPayModal.salary.staffId, ...payForm });
      await loadData();
      setShowPayModal(null);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openHistory = async (staffId: number, name: string) => {
    setShowHistoryModal({ staffId, name });
    try {
      const h = await api.getSalaryHistory(staffId);
      setHistory(h);
    } catch {}
  };

  const openDetail = (record: any) => {
    const staff = staffList.find(s => s.id === record.staffId);
    setShowDetailModal({ record, staff });
  };

  const addStaff = async () => {
    try {
      const body: any = { first_name: addForm.first_name, last_name: addForm.last_name, role: addForm.role, phone: addForm.phone, email: addForm.email, password: addForm.password || undefined, username: addForm.username, salary_type: addForm.salary_types, salary_value: addForm.salary_values };
      if (['courier', 'waiter', 'chef'].includes(addForm.role) && addForm.salary_types.length === 0) {
        body.salary_type = ['per_order'];
      }
      await api.createStaff(body);
      await loadData();
      setShowAddModal(false);
      setAddForm({ first_name: '', last_name: '', role: 'courier', phone: '', email: '', password: '', username: '', salary_types: [], salary_values: {} });
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const savePayrollSettings = async () => {
    try {
      await api.updatePayrollSettings(payrollSettings);
      addToast('Настройки сохранены', 'success');
      await loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addTimesheetRecord = async () => {
    try {
      await api.createTimesheetRecord({
        staff_id: Number(timesheetForm.staff_id),
        date: timesheetForm.date,
        start_time: timesheetForm.start_time,
        end_time: timesheetForm.end_time,
        break_minutes: Number(timesheetForm.break_minutes),
        note: timesheetForm.note,
      });
      addToast('Запись добавлена', 'success');
      setTimesheetForm({ staff_id: '', date: '', start_time: '', end_time: '', break_minutes: 0, note: '' });
      const ts = await api.getTimesheet({ month, year });
      setTimesheet(ts);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteTimesheetRecord = async (id: number) => {
    try {
      await api.deleteTimesheetRecord(id);
      setTimesheet(timesheet.filter(t => t.id !== id));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addKpi = async () => {
    try {
      await api.createKpiBonus(kpiForm);
      addToast('KPI добавлен', 'success');
      setKpiForm({ name: '', role: 'all', metric: 'orders_delivered', threshold: 0, bonus_amount: 0 });
      const kpi = await api.getKpiBonuses();
      setKpiBonuses(kpi);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const deleteKpi = async (id: number) => {
    try {
      await api.deleteKpiBonus(id);
      setKpiBonuses(kpiBonuses.filter(k => k.id !== id));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const exportTimesheetCSV = async () => {
    try {
      const rows = await api.exportTimesheet(month, year);
      const headers = 'ФИО,Должность,Дата,Часы,Ночные часы';
      const csv = [headers, ...rows.map((r: any) => `"${r.employee_name}","${r.position}","${r.date}","${r.hours}","${r.night_hours}"`)].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `timesheet_${year}_${month}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const exportCSV = () => {
    const headers = 'ФИО,Должность,Тип расчёта,Начислено,НДФЛ,К выплате,Выплачено,Статус';
    const rows = salaryRecords.map(r => {
      const staff = staffList.find(s => s.id === r.staffId);
      const fio = `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim() || '—';
      const role = ROLE_LABELS[staff?.role] || staff?.role || '—';
      return `"${fio}","${role}","${accruedTypes(r)}","${r.accruedAmount}","${r.ndflAmount || 0}","${r.netAmount || r.accruedAmount}","${r.paidAmount || 0}","${r.status === 'paid' ? 'Выплачено' : r.status === 'partial' ? 'Частично' : 'Начислено'}"`;
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `salary_${year}_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  function accruedTypes(record: any) {
    try {
      const d = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
      return Object.keys(d).map(k => SALARY_TYPE_LABELS[k] || k).join(', ') || '—';
    } catch { return '—'; }
  }

  function detailRows(details: any) {
    if (!details || typeof details === 'string') try { details = JSON.parse(details || '{}'); } catch { details = {}; }
    const rows: { label: string; amount: number }[] = [];
    if (details.fixed) rows.push({ label: 'Оклад', amount: details.fixed });
    if (details.per_order) rows.push({ label: `Заказы (${details.per_order.count} × ${details.per_order.rate}₽)`, amount: details.per_order.amount });
    if (details.per_km) rows.push({ label: `Километраж (${Math.round(details.per_km.km)} км × ${details.per_km.rate}₽)`, amount: details.per_km.amount });
    if (details.hourly) rows.push({ label: `Почасовой (${details.hourly.regular_hours} ч × ${details.hourly.rate}₽)`, amount: details.hourly.amount });
    if (details.night_bonus) rows.push({ label: `Ночные часы (${details.hourly?.night_hours || 0} ч)`, amount: details.night_bonus });
    if (details.holiday_bonus) rows.push({ label: `Праздничные часы (${details.hourly?.holiday_hours || 0} ч)`, amount: details.holiday_bonus });
    if (details.overtime_bonus) rows.push({ label: `Сверхурочные (${details.hourly?.overtime_hours || 0} ч)`, amount: details.overtime_bonus });
    if (details.kpi?.amount) rows.push({ label: `KPI бонусы`, amount: details.kpi.amount });
    rows.push({ label: 'НДФЛ', amount: details.ndfl || 0 });
    return rows;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="text-green-500" size={28} />
          <h1 className="text-2xl font-bold text-white">Зарплата</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700">
            {MONTHS.slice(1).map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {activeTab === 'salary' && (
            <>
              <button onClick={() => setShowCalcModal(true)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition"><Calculator size={16} /> Рассчитать</button>
              <button onClick={exportCSV} className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-zinc-700 transition"><Download size={16} /> Экспорт</button>
              <button onClick={() => setShowAddModal(true)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition"><UserPlus size={16} /> Добавить</button>
            </>
          )}
          {activeTab === 'timesheet' && (
            <button onClick={exportTimesheetCSV} className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-zinc-700 transition"><FileSpreadsheet size={16} /> Табель для контролирующих органов</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'salary', label: 'Начисления', icon: DollarSign },
          { key: 'settings', label: 'Настройки расчёта', icon: Settings2 },
          { key: 'timesheet', label: 'Табель учёта', icon: Clock },
          { key: 'kpi', label: 'KPI бонусы', icon: Award },
        ].map((t: any) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-500">Загрузка...</div>
      ) : (
        <>
          {activeTab === 'salary' && (
            <>
              <DashboardCards report={report} />
              {report?.monthlyTrend?.length > 0 && <Chart monthlyTrend={report.monthlyTrend} />}
              <SalaryTable records={salaryRecords} staffList={staffList} onCalculate={calculateOne} onPay={openPay} onHistory={openHistory} onDetail={openDetail} />
            </>
          )}

          {activeTab === 'settings' && (
            <div className="bg-zinc-900 rounded-2xl p-6 ring-1 ring-zinc-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings2 size={20} /> Настройки расчёта зарплаты</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div><label className="text-xs text-zinc-500">Ставка НДФЛ</label><input type="number" step="0.01" value={payrollSettings.ndfl_rate ?? 0.13} onChange={e => setPayrollSettings({ ...payrollSettings, ndfl_rate: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
                <div><label className="text-xs text-zinc-500">Коэффициент ночных часов</label><input type="number" step="0.1" value={payrollSettings.night_rate_multiplier ?? 1.5} onChange={e => setPayrollSettings({ ...payrollSettings, night_rate_multiplier: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
                <div><label className="text-xs text-zinc-500">Коэффициент праздничных часов</label><input type="number" step="0.1" value={payrollSettings.holiday_rate_multiplier ?? 2.0} onChange={e => setPayrollSettings({ ...payrollSettings, holiday_rate_multiplier: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
                <div><label className="text-xs text-zinc-500">Коэффициент сверхурочных</label><input type="number" step="0.1" value={payrollSettings.overtime_rate_multiplier ?? 1.5} onChange={e => setPayrollSettings({ ...payrollSettings, overtime_rate_multiplier: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
                <div><label className="text-xs text-zinc-500">Норма часов в день</label><input type="number" value={payrollSettings.daily_hours_norm ?? 8} onChange={e => setPayrollSettings({ ...payrollSettings, daily_hours_norm: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
                <div><label className="text-xs text-zinc-500">Норма часов в неделю</label><input type="number" value={payrollSettings.weekly_hours_norm ?? 40} onChange={e => setPayrollSettings({ ...payrollSettings, weekly_hours_norm: Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input id="kpi_enabled" type="checkbox" checked={payrollSettings.kpi_enabled !== 0} onChange={e => setPayrollSettings({ ...payrollSettings, kpi_enabled: e.target.checked ? 1 : 0 })} className="w-4 h-4 accent-blue-500" />
                <label htmlFor="kpi_enabled" className="text-sm text-zinc-300">Включить KPI бонусы</label>
              </div>
              <button onClick={savePayrollSettings} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Сохранить настройки</button>
            </div>
          )}

          {activeTab === 'timesheet' && (
            <div className="bg-zinc-900 rounded-2xl p-6 ring-1 ring-zinc-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Clock size={20} /> Табель учёта рабочего времени</h2>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
                <select value={timesheetForm.staff_id} onChange={e => setTimesheetForm({ ...timesheetForm, staff_id: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700">
                  <option value="">Сотрудник</option>
                  {staffList.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
                <input type="date" value={timesheetForm.date} onChange={e => setTimesheetForm({ ...timesheetForm, date: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <input type="time" value={timesheetForm.start_time} onChange={e => setTimesheetForm({ ...timesheetForm, start_time: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <input type="time" value={timesheetForm.end_time} onChange={e => setTimesheetForm({ ...timesheetForm, end_time: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <input type="number" placeholder="Перерыв, мин" value={timesheetForm.break_minutes} onChange={e => setTimesheetForm({ ...timesheetForm, break_minutes: Number(e.target.value) })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <button onClick={addTimesheetRecord} className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold">Добавить</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-800 text-zinc-500 text-xs"><th className="text-left px-3 py-2">Сотрудник</th><th className="text-left px-3 py-2">Дата</th><th className="text-left px-3 py-2">Начало</th><th className="text-left px-3 py-2">Конец</th><th className="text-left px-3 py-2">Перерыв</th><th className="text-left px-3 py-2">Примечание</th><th></th></tr></thead>
                  <tbody>
                    {timesheet.map(t => (
                      <tr key={t.id} className="border-b border-zinc-800/50">
                        <td className="px-3 py-2 text-white">{t.firstName} {t.lastName}</td>
                        <td className="px-3 py-2 text-zinc-400">{t.date}</td>
                        <td className="px-3 py-2 text-zinc-400">{t.startTime}</td>
                        <td className="px-3 py-2 text-zinc-400">{t.endTime}</td>
                        <td className="px-3 py-2 text-zinc-400">{t.breakMinutes} мин</td>
                        <td className="px-3 py-2 text-zinc-400">{t.note}</td>
                        <td className="px-3 py-2"><button onClick={() => deleteTimesheetRecord(t.id)} className="text-red-400 hover:text-red-300 text-xs">Удалить</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'kpi' && (
            <div className="bg-zinc-900 rounded-2xl p-6 ring-1 ring-zinc-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Award size={20} /> KPI бонусы</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
                <input value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} placeholder="Название" className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <select value={kpiForm.role} onChange={e => setKpiForm({ ...kpiForm, role: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700">
                  <option value="all">Все роли</option>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </select>
                <select value={kpiForm.metric} onChange={e => setKpiForm({ ...kpiForm, metric: e.target.value })} className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700">
                  {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="number" value={kpiForm.threshold} onChange={e => setKpiForm({ ...kpiForm, threshold: Number(e.target.value) })} placeholder="Порог" className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
                <input type="number" value={kpiForm.bonus_amount} onChange={e => setKpiForm({ ...kpiForm, bonus_amount: Number(e.target.value) })} placeholder="Бонус, ₽" className="bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm outline-none ring-1 ring-zinc-700" />
              </div>
              <button onClick={addKpi} className="mb-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Добавить KPI</button>
              <div className="space-y-2">
                {kpiBonuses.map(k => (
                  <div key={k.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{k.name}</p>
                      <p className="text-xs text-zinc-500">{ROLE_LABELS[k.role] || k.role || 'Все'} · {METRIC_LABELS[k.metric] || k.metric} ≥ {k.threshold} · бонус {k.bonus_amount}₽</p>
                    </div>
                    <button onClick={() => deleteKpi(k.id)} className="text-red-400 hover:text-red-300 text-xs">Удалить</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCalcModal && (
        <Modal onClose={() => setShowCalcModal(false)}>
          <h2 className="text-lg font-bold text-white mb-4">Расчёт зарплаты</h2>
          <p className="text-zinc-400 text-sm mb-4">Будет выполнен расчёт зарплаты для всех сотрудников за {MONTHS[month]} {year} года с учётом НДФЛ, ночных, праздничных и сверхурочных часов.</p>
          <div className="flex gap-3">
            <button onClick={calculateAll} disabled={calcLoading} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {calcLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Расчёт...</> : 'Рассчитать всех'}
            </button>
            <button onClick={() => setShowCalcModal(false)} className="flex-1 bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl">Отмена</button>
          </div>
        </Modal>
      )}

      {showPayModal && (
        <Modal onClose={() => setShowPayModal(null)}>
          <h2 className="text-lg font-bold text-white mb-4">Выплата зарплаты</h2>
          <p className="text-zinc-400 text-sm mb-2">{showPayModal.staff?.firstName} {showPayModal.staff?.lastName}</p>
          <p className="text-sm text-zinc-500 mb-4">Начислено: {showPayModal.salary.accruedAmount}₽ · НДФЛ: {showPayModal.salary.ndflAmount || 0}₽ · К выплате: {showPayModal.salary.netAmount || showPayModal.salary.accruedAmount}₽</p>
          <div className="space-y-3">
            <div><label className="text-xs text-zinc-500">Сумма</label><input type="number" value={payForm.amount || ''} onChange={e => setPayForm({ ...payForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
            <div><label className="text-xs text-zinc-500">Дата</label><input type="date" value={payForm.paid_date} onChange={e => setPayForm({ ...payForm, paid_date: e.target.value })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
            <div><label className="text-xs text-zinc-500">Способ</label>
              <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700">
                <option value="cash">Наличные</option><option value="card">Карта</option><option value="transfer">Перевод</option>
              </select>
            </div>
            <div><label className="text-xs text-zinc-500">Комментарий</label><input value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700" /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={confirmPay} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl">Подтвердить выплату</button>
            <button onClick={() => setShowPayModal(null)} className="flex-1 bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl">Отмена</button>
          </div>
        </Modal>
      )}

      {showHistoryModal && (
        <Modal onClose={() => setShowHistoryModal(null)}>
          <h2 className="text-lg font-bold text-white mb-4">История: {showHistoryModal.name}</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {history.salary.length === 0 && <p className="text-zinc-500 text-sm">Нет начислений</p>}
            {history.salary.map(r => (
              <div key={r.id} className="bg-zinc-800 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">{MONTHS[r.month]} {r.year}</span>
                  <span className="text-green-400 font-bold">{r.accruedAmount}₽</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>К выплате: {r.netAmount || r.accruedAmount}₽ · Выплачено: {r.paidAmount || 0}₽</span>
                  <span>{r.status === 'paid' ? '✅' : r.status === 'partial' ? '🟡' : '📋'}</span>
                </div>
              </div>
            ))}
            {history.log.length > 0 && <div className="border-t border-zinc-800 pt-3"><p className="text-xs font-semibold text-zinc-500 mb-2">Журнал операций</p>{history.log.map(l => (
              <div key={l.id} className="text-xs text-zinc-500 flex justify-between py-1"><span>{l.action === 'calculate' ? '📊' : '💳'} {l.detail || ''}</span><span>{new Date(l.createdAt).toLocaleString('ru-RU')}</span></div>
            ))}</div>}
          </div>
        </Modal>
      )}

      {showDetailModal && (
        <Modal onClose={() => setShowDetailModal(null)}>
          <h2 className="text-lg font-bold text-white mb-1">{showDetailModal.staff?.firstName} {showDetailModal.staff?.lastName}</h2>
          <p className="text-sm text-zinc-500 mb-4">{MONTHS[month]} {year}</p>
          <div className="space-y-2">
            {detailRows(showDetailModal.record.details).map((row, i) => (
              <div key={i} className={`flex justify-between rounded-xl px-4 py-3 ${row.label === 'НДФЛ' ? 'bg-red-500/10 border border-red-500/20' : 'bg-zinc-800'}`}>
                <span className={row.label === 'НДФЛ' ? 'text-red-400 text-sm' : 'text-zinc-300 text-sm'}>{row.label}</span>
                <span className={row.label === 'НДФЛ' ? 'text-red-400 font-bold' : 'text-white font-bold'}>{row.amount.toLocaleString()}₽</span>
              </div>
            ))}
            <div className="flex justify-between bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20">
              <span className="text-green-400 font-bold">К выплате (нетто)</span>
              <span className="text-green-400 font-bold">{showDetailModal.record.netAmount?.toLocaleString() || showDetailModal.record.accruedAmount?.toLocaleString()}₽</span>
            </div>
          </div>
        </Modal>
      )}

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <h2 className="text-lg font-bold text-white mb-4">Добавить сотрудника</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input value={addForm.first_name} onChange={e => setAddForm({ ...addForm, first_name: e.target.value })} placeholder="Имя *" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
              <input value={addForm.last_name} onChange={e => setAddForm({ ...addForm, last_name: e.target.value })} placeholder="Фамилия" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            </div>
            <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700">
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </select>
            <input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Телефон" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="Эл. почта" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} placeholder="Логин" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="Пароль" type="password" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <div className="bg-zinc-800 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-2 font-semibold">Тип зарплаты</p>
              <div className="space-y-2">
                {['salary', 'per_order', 'per_km', 'hourly'].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={addForm.salary_types.includes(t)} onChange={() => {
                      const types = addForm.salary_types.includes(t) ? addForm.salary_types.filter((x: string) => x !== t) : [...addForm.salary_types, t];
                      setAddForm({ ...addForm, salary_types: types });
                    }} className="accent-orange-500" />
                    <span className="text-sm text-zinc-300">{SALARY_TYPE_LABELS[t]}</span>
                    {addForm.salary_types.includes(t) && (
                      <input type="number" value={addForm.salary_values[t] || ''} onChange={e => setAddForm({ ...addForm, salary_values: { ...addForm.salary_values, [t]: Number(e.target.value) } })} placeholder="₽" className="ml-auto w-24 bg-zinc-700 text-white rounded-lg px-2 py-1 text-sm outline-none text-right" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addStaff} disabled={!addForm.first_name} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-60">Добавить</button>
            <button onClick={() => setShowAddModal(false)} className="flex-1 bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl">Отмена</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DashboardCards({ report }: { report: any }) {
  if (!report) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center"><DollarSign size={20} className="text-green-500" /></div><p className="text-xs text-zinc-500 font-semibold uppercase">Начислено всего</p></div>
        <p className="text-2xl font-extrabold text-white">{report.totalAccrued?.toLocaleString()}₽</p>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center"><Wallet size={20} className="text-blue-500" /></div><p className="text-xs text-zinc-500 font-semibold uppercase">Выплачено</p></div>
        <p className="text-2xl font-extrabold text-white">{report.totalPaid?.toLocaleString()}₽</p>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center"><Users size={20} className="text-purple-500" /></div><p className="text-xs text-zinc-500 font-semibold uppercase">Сотрудников</p></div>
        <p className="text-2xl font-extrabold text-white">{report.byRole?.reduce((a: number, b: any) => a + b.count, 0) || 0}</p>
        <div className="mt-2 space-y-1">{report.byRole?.map((r: any) => (
          <div key={r.role} className="flex justify-between text-xs"><span className="text-zinc-500">{ROLE_LABELS[r.role] || r.role}</span><span className="text-zinc-300">{r.count} чел, ср. {Math.round(r.avg).toLocaleString()}₽</span></div>
        ))}</div>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center"><TrendingUp size={20} className="text-amber-500" /></div><p className="text-xs text-zinc-500 font-semibold uppercase">Топ сотрудников</p></div>
        <div className="space-y-1">{report.topEarners?.map((e: any, i: number) => (
          <div key={i} className="flex justify-between text-xs"><span className="text-zinc-300 truncate">{e.firstName} {e.lastName}</span><span className="text-amber-400 font-semibold">{e.accruedAmount.toLocaleString()}₽</span></div>
        ))}</div>
      </div>
    </div>
  );
}

function Chart({ monthlyTrend }: { monthlyTrend: any[] }) {
  const max = Math.max(...monthlyTrend.map(t => t.total), 1);
  return (
    <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800 mb-6">
      <div className="flex items-center gap-2 mb-4"><BarChart3 size={18} className="text-blue-400" /><p className="text-sm font-bold text-white">Динамика начислений</p></div>
      <div className="flex items-end gap-2 h-32">
        {monthlyTrend.map((t, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-zinc-500">{Math.round(t.total).toLocaleString()}</span>
            <div className="w-full bg-blue-500/20 rounded-t-lg relative" style={{ height: `${(t.total / max) * 100}%` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg opacity-80" />
            </div>
            <span className="text-[10px] text-zinc-600">{MONTHS[t.month]?.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalaryTable({ records, staffList, onCalculate, onPay, onHistory, onDetail }: {
  records: any[]; staffList: any[];
  onCalculate: (id: number) => void; onPay: (r: any) => void;
  onHistory: (id: number, name: string) => void; onDetail: (r: any) => void;
}) {
  const roleLabels: Record<string, string> = { courier: 'Курьер', waiter: 'Официант', chef: 'Повар', kitchen: 'Повар', admin: 'Администратор', manager: 'Управляющий', stock_manager: 'Кладовщик', barmen: 'Бармен' };

  return (
    <div className="bg-zinc-900 rounded-2xl ring-1 ring-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">ФИО</th>
              <th className="text-left px-4 py-3 font-semibold">Должность</th>
              <th className="text-left px-4 py-3 font-semibold">Тип расчёта</th>
              <th className="text-right px-4 py-3 font-semibold">Начислено</th>
              <th className="text-right px-4 py-3 font-semibold">НДФЛ</th>
              <th className="text-right px-4 py-3 font-semibold">К выплате</th>
              <th className="text-right px-4 py-3 font-semibold">Выплачено</th>
              <th className="text-center px-4 py-3 font-semibold">Статус</th>
              <th className="text-right px-4 py-3 font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-zinc-500">Нет данных. Нажмите «Рассчитать» для начисления зарплаты.</td></tr>
            ) : records.map(r => {
              const staff = staffList.find(s => s.id === r.staffId);
              const fio = `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim() || '—';
              const role = roleLabels[staff?.role] || staff?.role || '—';
              const due = (r.netAmount || r.accruedAmount) - (r.paidAmount || 0);
              return (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                  <td className="px-4 py-3 text-white font-medium">{fio}</td>
                  <td className="px-4 py-3 text-zinc-400">{role}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {staff?.salaryType && Array.isArray(staff.salaryType) ? staff.salaryType.map((t: string) => SALARY_TYPE_LABELS[t] || t).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onDetail(r)} className="text-green-400 font-bold hover:text-green-300 transition flex items-center justify-end gap-1 ml-auto">
                      {r.accruedAmount?.toLocaleString()}₽ <Eye size={12} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-red-400">{r.ndflAmount ? `${r.ndflAmount.toLocaleString()}₽` : '—'}</td>
                  <td className="px-4 py-3 text-right text-blue-300 font-semibold">{r.netAmount ? `${r.netAmount.toLocaleString()}₽` : '—'}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{r.paidAmount ? `${r.paidAmount.toLocaleString()}₽` : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${r.status === 'paid' ? 'bg-green-500/20 text-green-400' : r.status === 'partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {r.status === 'paid' ? 'Выплачено' : r.status === 'partial' ? 'Частично' : 'Начислено'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {due > 0 && <button onClick={() => onPay(r)} className="text-[11px] bg-green-500/20 text-green-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-green-500/30 transition">Выплатить</button>}
                      <button onClick={() => onCalculate(r.staffId)} className="text-[11px] bg-blue-500/20 text-blue-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-500/30 transition">Пересчитать</button>
                      <button onClick={() => onHistory(r.staffId, fio)} className="text-[11px] bg-zinc-800 text-zinc-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-zinc-700 transition">История</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {staffList.filter(s => s.isActive && !records.find(r => r.staffId === s.id)).map(s => {
              const fio = `${s.firstName || ''} ${s.lastName || ''}`.trim() || '—';
              return (
                <tr key={`missing-${s.id}`} className="border-b border-zinc-800/50 opacity-60">
                  <td className="px-4 py-3 text-white font-medium">{fio}</td>
                  <td className="px-4 py-3 text-zinc-400">{roleLabels[s.role] || s.role}</td>
                  <td className="px-4 py-3 text-zinc-400">{Array.isArray(s.salaryType) ? s.salaryType.map((t: string) => SALARY_TYPE_LABELS[t] || t).join(', ') : '—'}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">—</td>
                  <td className="px-4 py-3 text-right text-zinc-600">—</td>
                  <td className="px-4 py-3 text-right text-zinc-600">—</td>
                  <td className="px-4 py-3 text-right text-zinc-600">—</td>
                  <td className="px-4 py-3 text-center"><span className="text-[11px] bg-zinc-800 text-zinc-600 px-2 py-1 rounded-full">Не рассчитан</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onCalculate(s.id)} className="text-[11px] bg-blue-500/20 text-blue-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-500/30 transition">Рассчитать</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md mx-4 ring-1 ring-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

