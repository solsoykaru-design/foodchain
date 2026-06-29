import { useState } from 'react';
import { BarChart3, DollarSign, Package, Megaphone, UsersRound, ClipboardCheck, Network, ChevronDown } from 'lucide-react';

interface TreeItem {
  id: string;
  label: string;
}

interface TreeGroup {
  id: string;
  label: string;
  icon: any;
  items: TreeItem[];
}

const groups: TreeGroup[] = [
  {
    id: 'network',
    label: 'Сеть',
    icon: Network,
    items: [
      { id: 'network/dashboard', label: 'Сводка по сети' },
    ],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: BarChart3,
    items: [
      { id: 'sales/summary', label: 'Сводка продаж' },
      { id: 'sales/daily', label: 'Ежедневные' },
      { id: 'sales/hourly', label: 'По часам' },
      { id: 'sales/weekday', label: 'По дням недели' },
      { id: 'sales/cumulative', label: 'Накопительные' },
      { id: 'sales/discounts', label: 'Скидки' },
      { id: 'sales/payment-sources', label: 'Источники оплат' },
      { id: 'sales/monthly', label: 'Помесячные' },
      { id: 'sales/order-source', label: 'Источник заказов' },
      { id: 'sales/order-type', label: 'Типы заказов' },
      { id: 'sales/payment-type', label: 'Типы оплат' },
      { id: 'sales/branches-daily', label: 'По филиалам (день)' },
      { id: 'sales/branches-monthly', label: 'По филиалам (мес.)' },
    ],
  },
  {
    id: 'finance',
    label: 'Финансы',
    icon: DollarSign,
    items: [
      { id: 'finance/profit-daily', label: 'Прибыль по дням' },
      { id: 'finance/profit-branches', label: 'Прибыль по филиалам' },
      { id: 'finance/profit-products', label: 'Прибыль по товарам' },
      { id: 'finance/profit-categories', label: 'Прибыль по категориям' },
      { id: 'finance/abc-analysis', label: 'ABC-анализ' },
      { id: 'finance/pnl', label: 'Прибыли и убытки' },
      { id: 'finance/income-expense', label: 'Доходы и расходы' },
      { id: 'finance/payments-daily', label: 'Платежи по дням' },
      { id: 'finance/reconciliation', label: 'Сверка' },
    ],
  },
  {
    id: 'stock',
    label: 'Склад',
    icon: Package,
    items: [
      { id: 'stock/low-stock', label: 'Остатки ниже нормы' },
      { id: 'stock/purchase-prices-monthly', label: 'Цены закупок' },
      { id: 'stock/movement-log', label: 'Журнал движений' },
      { id: 'stock/estimated-balance', label: 'Оценочный остаток' },
      { id: 'stock/detailed-balance', label: 'Детальный остаток' },
      { id: 'stock/transfers', label: 'Перемещения' },
      { id: 'stock/calories', label: 'Калорийность' },
      { id: 'stock/food-cost', label: 'Фудкост / Себестоимость' },
      { id: 'stock/inventory-variance', label: 'Расхождения инвентаризации' },
    ],
  },
  {
    id: 'marketing',
    label: 'Маркетинг',
    icon: Megaphone,
    items: [
      { id: 'marketing/sales-by-customer', label: 'Продажи по клиентам' },
      { id: 'marketing/promo-history', label: 'История акций' },
      { id: 'marketing/bonus-report', label: 'Бонусный отчёт' },
      { id: 'marketing/card-connections', label: 'Подключения карт' },
      { id: 'marketing/contacts', label: 'Контакты' },
    ],
  },
  {
    id: 'staff',
    label: 'Сотрудники',
    icon: UsersRound,
    items: [
      { id: 'staff/sales-by-cashier', label: 'Продажи по кассирам' },
      { id: 'staff/sales-by-staff', label: 'Продажи по сотрудникам' },
      { id: 'staff/bonuses', label: 'Бонусы' },
      { id: 'staff/tips', label: 'Чаевые' },
    ],
  },
  {
    id: 'fulfillment',
    label: 'Выполнение заказов',
    icon: ClipboardCheck,
    items: [
      { id: 'fulfillment/issuers', label: 'Выдачи' },
      { id: 'fulfillment/delivery-orders', label: 'Доставка' },
      { id: 'fulfillment/orders', label: 'Заказы' },
      { id: 'fulfillment/summary', label: 'Сводка' },
    ],
  },
];

interface TreeMenuProps {
  activeReport: string;
  onSelect: (reportId: string) => void;
}

export default function TreeMenu({ activeReport, onSelect }: TreeMenuProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach(g => {
      if (g.items.some(i => i.id === activeReport)) initial[g.id] = true;
    });
    if (Object.keys(initial).length === 0) initial['sales'] = true;
    return initial;
  });

  const toggleGroup = (id: string) => setOpenGroups(o => ({ ...o, [id]: !o[id] }));

  return (
    <nav className="w-64 shrink-0 space-y-1">
      {groups.map(group => {
        const isOpen = openGroups[group.id];
        const hasActive = group.items.some(i => i.id === activeReport);
        return (
          <div key={group.id}>
            <button onClick={() => toggleGroup(group.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${hasActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <group.icon size={20} />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {isOpen && (
              <div className="ml-1 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5 mt-0.5 mb-1">
                {group.items.map(item => (
                  <button key={item.id} onClick={() => onSelect(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${activeReport === item.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
