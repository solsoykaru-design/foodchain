import { useState, useEffect, useCallback } from 'react';
import { Receipt, FileText, Calculator, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../api';

type Tab = 'sales' | 'purchases' | 'declaration';

const RATE_LABELS: Record<string, string> = {
  none: 'Без НДС', vat0: '0%', vat10: '10%', vat20: '20%',
  vat10_110: '10/110', vat20_120: '20/120',
};

export default function TaxAccountingPage() {
  const now = new Date();
  const [tab, setTab] = useState<Tab>('declaration');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'sales') res = await api.getSalesLedger(year, month);
      else if (tab === 'purchases') res = await api.getPurchaseLedger(year, month);
      else res = await api.getVatDeclaration(year, month);
      setData(res);
    } catch { setData(null); }
    setLoading(false);
  }, [tab, year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };
  const monthLabel = `${String(month).padStart(2, '0')}.${year}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
          <Calculator size={22} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Налоговый учёт (НДС)</h1>
          <p className="text-sm text-zinc-500">Книга продаж, книга покупок, декларация по НДС</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-2xl p-2 shadow-sm">
          {(['declaration', 'sales', 'purchases'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === t ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}>
              {t === 'declaration' ? <Calculator size={16} /> : t === 'sales' ? <Receipt size={16} /> : <FileText size={16} />}
              {t === 'declaration' ? 'Декларация' : t === 'sales' ? 'Книга продаж' : 'Книга покупок'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium w-20 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm text-center py-12 text-zinc-400">Загрузка...</div>
      ) : !data ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm text-center py-12 text-zinc-400">Нет данных</div>
      ) : tab === 'declaration' ? (
        <DeclarationView data={data} />
      ) : tab === 'sales' ? (
        <SalesLedgerView data={data} rateLabels={RATE_LABELS} />
      ) : (
        <PurchaseLedgerView data={data} rateLabels={RATE_LABELS} />
      )}
    </div>
  );
}

function DeclarationView({ data }: { data: any }) {
  const { summary, salesByRate, purchaseByRate } = data;
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">НДС с продаж</p>
          <p className="text-2xl font-bold text-blue-600">{summary.salesVat.toFixed(2)} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">НДС к вычету</p>
          <p className="text-2xl font-bold text-emerald-600">{summary.purchaseVat.toFixed(2)} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">НДС к уплате</p>
          <p className={`text-2xl font-bold ${summary.payable >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {summary.payable.toFixed(2)} ₽
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Оборот (продажи)</p>
          <p className="text-2xl font-bold">{summary.salesGross.toFixed(2)} ₽</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Продажи по ставкам</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Ставка</th>
              <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Нетто</th>
              <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">НДС</th>
            </tr></thead>
            <tbody>
              {salesByRate.map((r: any) => (
                <tr key={r.rate} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-2 font-medium">{RATE_LABELS[r.rate] || r.rate}</td>
                  <td className="px-2 py-2 text-right">{r.net.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-medium">{r.vat.toFixed(2)}</td>
                </tr>
              ))}
              {salesByRate.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-zinc-400">Нет продаж</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Закупки по ставкам</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Ставка</th>
              <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Нетто</th>
              <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">НДС</th>
            </tr></thead>
            <tbody>
              {purchaseByRate.map((r: any) => (
                <tr key={r.rate} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-2 font-medium">{RATE_LABELS[r.rate] || r.rate}</td>
                  <td className="px-2 py-2 text-right">{r.net.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-medium">{r.vat.toFixed(2)}</td>
                </tr>
              ))}
              {purchaseByRate.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-zinc-400">Нет закупок</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SalesLedgerView({ data, rateLabels }: { data: any; rateLabels: Record<string, string> }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm overflow-x-auto">
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span>Продаж: <strong>{data.summary.count}</strong></span>
        <span>Нетто: <strong>{data.summary.totalNet.toFixed(2)} ₽</strong></span>
        <span>НДС: <strong>{data.summary.totalVat.toFixed(2)} ₽</strong></span>
        <span>Всего: <strong>{data.summary.totalGross.toFixed(2)} ₽</strong></span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Заказ</th>
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Дата</th>
          <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Сумма</th>
          <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">НДС</th>
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Тип</th>
        </tr></thead>
        <tbody>
          {data.entries.map((e: any) => (
            <tr key={e.order_id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-2 py-2 font-medium">#{e.order_id}</td>
              <td className="px-2 py-2 text-zinc-500">{e.date}</td>
              <td className="px-2 py-2 text-right font-medium">{e.total.toFixed(2)}</td>
              <td className="px-2 py-2 text-right text-amber-600 font-medium">{e.vatTotal.toFixed(2)}</td>
              <td className="px-2 py-2">{e.order_type === 'dine-in' ? 'В зале' : e.order_type === 'delivery' ? 'Доставка' : e.order_type}</td>
            </tr>
          ))}
          {data.entries.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-zinc-400">Нет данных</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseLedgerView({ data, rateLabels }: { data: any; rateLabels: Record<string, string> }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm overflow-x-auto">
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span>Закупок: <strong>{data.summary.count}</strong></span>
        <span>Нетто: <strong>{data.summary.totalNet.toFixed(2)} ₽</strong></span>
        <span>НДС к вычету: <strong>{data.summary.totalVat.toFixed(2)} ₽</strong></span>
        <span>Всего: <strong>{data.summary.totalGross.toFixed(2)} ₽</strong></span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Документ</th>
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Дата</th>
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Товар</th>
          <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">Сумма</th>
          <th className="text-right px-2 py-1.5 text-xs font-medium text-zinc-500">НДС</th>
          <th className="text-left px-2 py-1.5 text-xs font-medium text-zinc-500">Ставка</th>
        </tr></thead>
        <tbody>
          {data.entries.map((e: any, i: number) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-2 py-2 font-medium">#{e.doc_id}</td>
              <td className="px-2 py-2 text-zinc-500">{e.date}</td>
              <td className="px-2 py-2">{e.item}</td>
              <td className="px-2 py-2 text-right font-medium">{e.gross.toFixed(2)}</td>
              <td className="px-2 py-2 text-right text-emerald-600 font-medium">{e.vat.toFixed(2)}</td>
              <td className="px-2 py-2">{rateLabels[e.vatRate] || e.vatRate}</td>
            </tr>
          ))}
          {data.entries.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-zinc-400">Нет данных</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
