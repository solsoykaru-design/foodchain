import { useState, useCallback } from 'react';
import TreeMenu from './TreeMenu';
import ReportFilters from './components/ReportFilters';

import SalesSummary from './sales/SalesSummary';
import SalesDaily from './sales/SalesDaily';
import SalesHourly from './sales/SalesHourly';
import SalesWeekday from './sales/SalesWeekday';
import SalesCumulative from './sales/SalesCumulative';
import SalesDiscounts from './sales/SalesDiscounts';
import SalesPaymentSources from './sales/SalesPaymentSources';
import SalesMonthly from './sales/SalesMonthly';
import SalesOrderSource from './sales/SalesOrderSource';
import SalesOrderType from './sales/SalesOrderType';
import SalesPaymentType from './sales/SalesPaymentType';
import SalesBranchesDaily from './sales/SalesBranchesDaily';
import SalesBranchesMonthly from './sales/SalesBranchesMonthly';

import ProfitDaily from './finance/ProfitDaily';
import ProfitBranches from './finance/ProfitBranches';
import ProfitProducts from './finance/ProfitProducts';
import ProfitCategories from './finance/ProfitCategories';
import AbcAnalysis from './finance/AbcAnalysis';
import PnL from './finance/PnL';
import IncomeExpense from './finance/IncomeExpense';
import PaymentsDaily from './finance/PaymentsDaily';
import Reconciliation from './finance/Reconciliation';

import LowStock from './stock/LowStock';
import PurchasePricesMonthly from './stock/PurchasePricesMonthly';
import MovementLog from './stock/MovementLog';
import EstimatedBalance from './stock/EstimatedBalance';
import DetailedBalance from './stock/DetailedBalance';
import Transfers from './stock/Transfers';
import Calories from './stock/Calories';
import FoodCost from './stock/FoodCost';
import InventoryVariance from './stock/InventoryVariance';

import SalesByCustomer from './marketing/SalesByCustomer';
import PromoHistory from './marketing/PromoHistory';
import BonusReport from './marketing/BonusReport';
import CardConnections from './marketing/CardConnections';
import Contacts from './marketing/Contacts';

import SalesByCashier from './staff/SalesByCashier';
import SalesByStaff from './staff/SalesByStaff';
import StaffBonuses from './staff/StaffBonuses';
import StaffTips from './staff/StaffTips';

import Issuers from './fulfillment/Issuers';
import DeliveryOrders from './fulfillment/DeliveryOrders';
import FulfillmentOrders from './fulfillment/FulfillmentOrders';
import FulfillmentSummary from './fulfillment/FulfillmentSummary';

import NetworkDashboard from './network/NetworkDashboard';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('sales/summary');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branchId, setBranchId] = useState<number | undefined>(undefined);

  const handleFilterChange = useCallback((filters: { from: string; to: string; branchId?: number; custom: Record<string, string> }) => {
    setFrom(filters.from);
    setTo(filters.to);
    setBranchId(filters.branchId);
  }, []);

  const renderReport = () => {
    const props = { from, to, branchId };
    switch (activeReport) {
      case 'sales/summary': return <SalesSummary {...props} />;
      case 'sales/daily': return <SalesDaily {...props} />;
      case 'sales/hourly': return <SalesHourly {...props} />;
      case 'sales/weekday': return <SalesWeekday {...props} />;
      case 'sales/cumulative': return <SalesCumulative {...props} />;
      case 'sales/discounts': return <SalesDiscounts {...props} />;
      case 'sales/payment-sources': return <SalesPaymentSources {...props} />;
      case 'sales/monthly': return <SalesMonthly {...props} />;
      case 'sales/order-source': return <SalesOrderSource {...props} />;
      case 'sales/order-type': return <SalesOrderType {...props} />;
      case 'sales/payment-type': return <SalesPaymentType {...props} />;
      case 'sales/branches-daily': return <SalesBranchesDaily {...props} />;
      case 'sales/branches-monthly': return <SalesBranchesMonthly {...props} />;
      case 'finance/profit-daily': return <ProfitDaily {...props} />;
      case 'finance/profit-branches': return <ProfitBranches {...props} />;
      case 'finance/profit-products': return <ProfitProducts {...props} />;
      case 'finance/profit-categories': return <ProfitCategories {...props} />;
      case 'finance/abc-analysis': return <AbcAnalysis {...props} />;
      case 'finance/pnl': return <PnL {...props} />;
      case 'finance/income-expense': return <IncomeExpense {...props} />;
      case 'finance/payments-daily': return <PaymentsDaily {...props} />;
      case 'finance/reconciliation': return <Reconciliation {...props} />;
      case 'stock/low-stock': return <LowStock {...props} />;
      case 'stock/purchase-prices-monthly': return <PurchasePricesMonthly {...props} />;
      case 'stock/movement-log': return <MovementLog {...props} />;
      case 'stock/estimated-balance': return <EstimatedBalance {...props} />;
      case 'stock/detailed-balance': return <DetailedBalance {...props} />;
      case 'stock/transfers': return <Transfers {...props} />;
      case 'stock/calories': return <Calories {...props} />;
      case 'stock/food-cost': return <FoodCost />;
      case 'stock/inventory-variance': return <InventoryVariance {...props} />;
      case 'marketing/sales-by-customer': return <SalesByCustomer {...props} />;
      case 'marketing/promo-history': return <PromoHistory {...props} />;
      case 'marketing/bonus-report': return <BonusReport {...props} />;
      case 'marketing/card-connections': return <CardConnections {...props} />;
      case 'marketing/contacts': return <Contacts {...props} />;
      case 'staff/sales-by-cashier': return <SalesByCashier {...props} />;
      case 'staff/sales-by-staff': return <SalesByStaff {...props} />;
      case 'staff/bonuses': return <StaffBonuses {...props} />;
      case 'staff/tips': return <StaffTips {...props} />;
      case 'fulfillment/issuers': return <Issuers {...props} />;
      case 'fulfillment/delivery-orders': return <DeliveryOrders {...props} />;
      case 'fulfillment/orders': return <FulfillmentOrders {...props} />;
      case 'fulfillment/summary': return <FulfillmentSummary {...props} />;
      case 'network/dashboard': return <NetworkDashboard from={from} to={to} />;
      default: return <SalesSummary {...props} />;
    }
  };

  return (
    <div className="flex gap-6">
      <div className="sticky top-0 self-start max-h-[calc(100vh-96px)] overflow-y-auto">
        <TreeMenu activeReport={activeReport} onSelect={setActiveReport} />
      </div>
      <div className="flex-1 min-w-0 space-y-6">
        <ReportFilters
          from={from}
          to={to}
          branchId={branchId}
          onChange={handleFilterChange}
        />
        {renderReport()}
      </div>
    </div>
  );
}
