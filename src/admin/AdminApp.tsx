import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { ToastProvider, addToast } from '../ToastContext';
import { AdminPage, UserRole } from '../types';

import DashboardPage from './DashboardPage';
import OrdersPage from './OrdersPage';
import ClientsPage from './ClientsPage';
import PickupPointsPage from './PickupPointsPage';
import StaffPage from './StaffPage';
import KitchenPage from './KitchenPage';
import MenuPage from './MenuPage';
import MenuItemsList from './MenuItemsList';
import CategoriesPage from './CategoriesPage';
import TechCardsPage from './TechCardsPage';
import BookingsPage from './BookingsPage';
import InventoryPage from './InventoryPage';
import InventoryItemsPage from './InventoryItemsPage';
import StockCategoriesPage from './StockCategoriesPage';
import WarehousesPage from './WarehousesPage';
import WorkshopsPage from './WorkshopsPage';
import CounterpartiesPage from './CounterpartiesPage';
import WholesalePricesPage from './WholesalePricesPage';
import DeliveryPage from './DeliveryPage';
import FinancePage from './FinancePage';
import MarketingPage from './MarketingPage';
import ReviewsPage from './ReviewsPage';
import SettingsPage from './SettingsPage';
import AuditPage from './AuditPage';
import PaymentSettingsPage from './PaymentSettingsPage';
import SalaryPage from './SalaryPage';
import DocumentsPage from './DocumentsPage';
import MenuCategoriesPage from './MenuCategoriesPage';
import MessagesPage from './MessagesPage';
import NotificationsPage from './NotificationsPage';
import PushSettingsPage from './PushSettingsPage';
import ClientGroupsPage from './ClientGroupsPage';
import BranchesPage from './BranchesPage';
import MenuModifiersPage from './MenuModifiersPage';
import MenuModifierGroupsPage from './MenuModifierGroupsPage';
import MenuPriceListsPage from './MenuPriceListsPage';
import MenuWeeklyMenuPage from './MenuWeeklyMenuPage';
import MenuStopListsPage from './MenuStopListsPage';
import LanguagesPage from './LanguagesPage';
import ReviewQuestionsPage from './ReviewQuestionsPage';
import AggregatorsPage from './AggregatorsPage';
import Integration1CPage from './Integration1CPage';
import PaymentsPage from './PaymentsPage';
import SecurityPage from './SecurityPage';
import ForecastPage from './ForecastPage';
import AutoOrdersPage from './AutoOrdersPage';
import ReportsPage from './reports/ReportsPage';
import AppManagementPage from './AppManagementPage';
import AdminChatsPage from './AdminChatsPage';
import AdminStaffChatsPage from './AdminStaffChatsPage';
import AdminCourierGuestChatsPage from './AdminCourierGuestChatsPage';
import AdminLoyaltyPage from './AdminLoyaltyPage';
import FiscalizationPage from './FiscalizationPage';
import TerminalSettingsPage from './TerminalSettingsPage';
import ShiftsPage from './ShiftsPage';
import AutoWriteoffPage from './AutoWriteoffPage';
import CostingPage from './CostingPage';
import EmailSettingsPage from './EmailSettingsPage';
import BankStatementPage from './BankStatementPage';
import StaffSchedulePage from './StaffSchedulePage';
import CrmIntegrationPage from './CrmIntegrationPage';
import TaxAccountingPage from './TaxAccountingPage';
import BalanceSheetPage from './BalanceSheetPage';
import SupplierPortalPage from './SupplierPortalPage';
import TelegramBotPage from './TelegramBotPage';
import BarcodeManagementPage from './BarcodeManagementPage';
import FranchisingPage from './FranchisingPage';
import FohDisplayPage from './FohDisplayPage';
import YandexAfishaPage from './YandexAfishaPage';
import SwaggerPage from './SwaggerPage';
import ExtensionsPage from './ExtensionsPage';
import TelephonyPage from './TelephonyPage';
import HonestSignPage from './HonestSignPage';
import TelephonyOperatorPage from './TelephonyOperatorPage';
import ExtensionsSdkPage from './ExtensionsSdkPage';
import GamificationPage from './GamificationPage';
import CurrencySettingsPage from './CurrencySettingsPage';
import { setDocType, getDocType } from './docStore';
import * as api from '../api';
import { onEvent } from '../api';
import ThemeSelector from '../themes/ThemeSelector';
import ThemeConstructor from '../themes/ThemeConstructor';
import BrandingPage from './BrandingPage';
import SiteSettingsPage from './SiteSettingsPage';
import LanguageSelector from './LanguageSelector';
import { LayoutDashboard, ShoppingBag, BookOpen, CalendarDays, CalendarX, Calculator, Warehouse, Truck, DollarSign, Megaphone, UsersRound, Settings, Shield, ShieldCheck, ChefHat, Bell, Moon, Sun, LogOut, Users, MessageSquare, MessageCircle, MapPin, FileText, FolderTree, CreditCard, Wallet, RefreshCw, ChevronDown, Package, Building2, Factory, Handshake, Receipt, Files, FileSpreadsheet, ClipboardList, ArrowDownUp, PackageSearch, FlaskConical, ArrowLeftRight, FileUp, Scissors, Cog, ShoppingCart, Hammer, Handshake as HandshakeIcon, Globe, Menu as MenuIcon, X, Palette, BarChart3, Calendar, GitCompare, Smartphone, Award, Printer, Mail, FileJson, Monitor, Puzzle, Phone, PhoneCall, Gamepad2, Code } from 'lucide-react';

export default function AdminApp({ onLogout }: { onLogout?: () => void }) {
  const { adminPage, setAdminPage } = useApp();
  const { t } = useTranslation();
  // addToast is imported globally from ToastContext
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [demoMode, setDemoMode] = useState<{ is_demo: boolean; access_mode: string } | null>(null);

  useEffect(() => {
    api.get('/api/tenant-mode').then((data: any) => {
      if (data && data.is_demo) setDemoMode(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.getSettings().then(s => {
      if (s.app_name) { document.title = s.app_name; }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.connectWebSocket((data: any) => {
      if (data.type === 'order:update' || data.type === 'order:new') {
        window.dispatchEvent(new CustomEvent('order:update'));
      }
      if (data.type === 'order:new') {
        addToast(`Новый заказ #${data.orderId || ''}`, 'info');
      }
      window.dispatchEvent(new CustomEvent(data.type, { detail: data }));
    });
    return () => { api.disconnectWebSocket(); };
  }, []);

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {demoMode?.is_demo && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center text-xs font-bold py-1.5 tracking-wider flex items-center justify-center gap-2 shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          ДЕМО-РЕЖИМ — данные не являются боевыми
          {demoMode.access_mode && <span className="hidden sm:inline text-white/80 font-normal">· {demoMode.access_mode}</span>}
        </div>
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={`flex flex-col flex-1 min-w-0 ml-0 md:ml-64 ${demoMode?.is_demo ? 'pt-7' : ''}`}>
        <TopBar onLogout={onLogout} onRefresh={() => setRefreshKey(k => k + 1)} onMenuToggle={() => setSidebarOpen(o => !o)} />
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {adminPage === 'dashboard' && <DashboardPage key={refreshKey} />}
          {adminPage === 'orders' && <OrdersPage key={refreshKey} />}
          {adminPage === 'kitchen' && <KitchenPage key={refreshKey} />}
          {adminPage === 'categories' && <CategoriesPage key={refreshKey} />}
          {adminPage === 'menu' && <MenuPage key={refreshKey} />}
          {adminPage === 'tech_cards' && <TechCardsPage key={refreshKey} />}
          {adminPage === 'bookings' && <BookingsPage key={refreshKey} />}
          {adminPage === 'inventory' && <InventoryPage key={refreshKey} />}
          {adminPage === 'inventory_items' && <InventoryItemsPage key={refreshKey} />}
          {adminPage === 'stock_categories' && <StockCategoriesPage key={refreshKey} />}
          {adminPage === 'warehouses' && <WarehousesPage key={refreshKey} />}
          {adminPage === 'workshops' && <WorkshopsPage key={refreshKey} />}
          {adminPage === 'counterparties' && <CounterpartiesPage key={refreshKey} />}
          {adminPage === 'wholesale_prices' && <WholesalePricesPage key={refreshKey} />}
          {adminPage === 'pickup_points' && <PickupPointsPage key={refreshKey} />}
          {adminPage === 'delivery' && <DeliveryPage key={refreshKey} />}
          {adminPage === 'finance' && <FinancePage key={refreshKey} />}
          {adminPage === 'marketing' && <MarketingPage key={refreshKey} />}
          {adminPage === 'clients' && <ClientsPage key={refreshKey} />}
          {adminPage === 'reviews' && <ReviewsPage key={refreshKey} />}
          {adminPage === 'staff' && <StaffPage key={refreshKey} />}
          {adminPage === 'settings' && <SettingsPage key={refreshKey} />}
          {adminPage === 'payment_settings' && <PaymentSettingsPage key={refreshKey} />}
          {adminPage === 'salary' && <SalaryPage key={refreshKey} />}
          {adminPage === 'audit' && <AuditPage key={refreshKey} />}
          {adminPage === 'menu_items' && <MenuItemsList key={refreshKey} />}
          {adminPage === 'menu_categories' && <MenuCategoriesPage key={refreshKey} />}
          {adminPage === 'menu_modifiers' && <MenuModifiersPage key={refreshKey} />}
          {adminPage === 'menu_modifier_groups' && <MenuModifierGroupsPage key={refreshKey} />}
          {adminPage === 'menu_price_lists' && <MenuPriceListsPage key={refreshKey} />}
          {adminPage === 'menu_weekly_menu' && <MenuWeeklyMenuPage key={refreshKey} />}
          {adminPage === 'menu_stop_lists' && <MenuStopListsPage key={refreshKey} />}
          {adminPage === 'menu_languages' && <LanguagesPage key={refreshKey} />}
          {adminPage === 'client_groups' && <ClientGroupsPage key={refreshKey} />}
          {adminPage === 'branches' && <BranchesPage key={refreshKey} />}
          {adminPage === 'review_questions' && <ReviewQuestionsPage key={refreshKey} />}
          {adminPage === 'documents' && <DocumentsPage key={refreshKey} />}
          {adminPage === 'messages' && <MessagesPage key={refreshKey} />}
          {adminPage === 'notifications' && <NotificationsPage key={refreshKey} />}
          {adminPage === 'push_settings' && <PushSettingsPage key={refreshKey} />}
          {adminPage === 'aggregators' && <AggregatorsPage key={refreshKey} />}
          {adminPage === 'integration_1c' && <Integration1CPage key={refreshKey} />}
          {adminPage === 'payments' && <PaymentsPage key={refreshKey} />}
          {adminPage === 'security' && <SecurityPage key={refreshKey} />}
          {adminPage === 'forecast' && <ForecastPage key={refreshKey} />}
          {adminPage === 'auto_orders' && <AutoOrdersPage key={refreshKey} />}
          {adminPage === 'reports' && <ReportsPage key={refreshKey} />}
          {adminPage === 'theme_constructor' && <ThemeConstructor />}
          {adminPage === 'branding' && <BrandingPage key={refreshKey} />}
          {adminPage === 'site_settings' && <SiteSettingsPage key={refreshKey} />}
          {adminPage === 'app_management' && <AppManagementPage key={refreshKey} />}
          {adminPage === 'chats' && <AdminChatsPage key={refreshKey} />}
          {adminPage === 'staff_chats' && <AdminStaffChatsPage key={refreshKey} />}
          {adminPage === 'courier_guest_chats' && <AdminCourierGuestChatsPage key={refreshKey} />}
          {adminPage === 'loyalty' && <AdminLoyaltyPage key={refreshKey} />}
          {adminPage === 'fiscalization' && <FiscalizationPage key={refreshKey} />}
          {adminPage === 'terminal' && <TerminalSettingsPage key={refreshKey} />}
          {adminPage === 'shifts' && <ShiftsPage key={refreshKey} />}
          {adminPage === 'email_settings' && <EmailSettingsPage key={refreshKey} />}
          {adminPage === 'bank_statement' && <BankStatementPage key={refreshKey} />}
          {adminPage === 'staff_schedule' && <StaffSchedulePage key={refreshKey} />}
          {adminPage === 'crm_integration' && <CrmIntegrationPage key={refreshKey} />}
          {adminPage === 'tax_accounting' && <TaxAccountingPage key={refreshKey} />}
          {adminPage === 'auto_writeoff' && <AutoWriteoffPage key={refreshKey} />}
          {adminPage === 'costing' && <CostingPage key={refreshKey} />}
          {adminPage === 'balance_sheet' && <BalanceSheetPage key={refreshKey} />}
          {adminPage === 'supplier_portal' && <SupplierPortalPage key={refreshKey} />}
          {adminPage === 'telegram_bot' && <TelegramBotPage key={refreshKey} />}
          {adminPage === 'barcodes' && <BarcodeManagementPage key={refreshKey} />}
          {adminPage === 'yandex_afisha' && <YandexAfishaPage key={refreshKey} />}
          {adminPage === 'swagger_docs' && <SwaggerPage key={refreshKey} />}
          {adminPage === 'franchising' && <FranchisingPage key={refreshKey} />}
          {adminPage === 'extensions' && <ExtensionsPage key={refreshKey} />}
          {adminPage === 'telephony' && <TelephonyPage key={refreshKey} />}
          {adminPage === 'telephony_operator' && <TelephonyOperatorPage key={refreshKey} />}
          {adminPage === 'extensions_sdk' && <ExtensionsSdkPage key={refreshKey} />}
          {adminPage === 'gamification' && <GamificationPage key={refreshKey} />}
          {adminPage === 'currency_settings' && <CurrencySettingsPage key={refreshKey} />}
          {adminPage === 'foh_display' && <FohDisplayPage key={refreshKey} />}
          {adminPage === 'honest_sign' && <HonestSignPage key={refreshKey} />}
          {!['dashboard', 'orders', 'categories', 'kitchen', 'menu', 'tech_cards', 'bookings', 'inventory', 'inventory_items', 'stock_categories', 'warehouses', 'workshops', 'counterparties', 'wholesale_prices', 'pickup_points', 'delivery', 'finance', 'marketing', 'clients', 'reviews', 'staff', 'settings', 'payment_settings', 'salary', 'audit', 'documents', 'menu_items', 'menu_categories', 'menu_modifiers', 'menu_modifier_groups', 'menu_price_lists', 'menu_weekly_menu', 'menu_stop_lists', 'menu_languages', 'messages', 'notifications', 'push_settings', 'client_groups', 'branches', 'review_questions', 'theme_constructor', 'security', 'forecast', 'integration_1c', 'auto_orders', 'branding', 'site_settings', 'reports', 'app_management', 'chats', 'staff_chats', 'courier_guest_chats', 'loyalty', 'fiscalization', 'terminal', 'shifts', 'auto_writeoff', 'costing', 'email_settings', 'bank_statement', 'staff_schedule', 'crm_integration', 'tax_accounting', 'balance_sheet', 'supplier_portal', 'telegram_bot', 'barcodes', 'swagger_docs', 'yandex_afisha', 'franchising', 'honest_sign', 'foh_display', 'extensions', 'telephony', 'telephony_operator', 'extensions_sdk', 'gamification', 'currency_settings'].includes(adminPage) && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-zinc-500 dark:text-zinc-400">{t('page_developing')}: {adminPage}</p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

export function AdminAppWrapper({ onLogout }: { onLogout?: () => void }) {
  return (
    <ToastProvider>
      <AdminApp onLogout={onLogout} />
    </ToastProvider>
  );
}

type MenuItem = { id: string; icon: any; label: string; roles?: UserRole[]; badge?: (count: number, late: number, users: number) => any };
type SubMenuItem = { id: string; icon: any; label: string; onClick?: () => void };
type MenuGroup = { id: string; label: string; icon: any; roles?: UserRole[]; items: (MenuItem | { id: string; icon: any; label: string; roles?: UserRole[]; subItems: SubMenuItem[] })[] };

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { adminPage, setAdminPage, adminRole, registeredUsers } = useApp();
  const { t, i18n } = useTranslation();
  const [orderCount, setOrderCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [appName, setAppName] = useState('Панель управления');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const orders = await api.getOrders();
        const active = orders.filter((o: any) => ['new','confirmed','preparing','ready','assigned','en_route'].includes(o.status)).length;
        const late = orders.filter((o: any) => (o.status === 'new' || o.status === 'confirmed') && (Date.now() - new Date(o.createdAt).getTime()) > 30 * 60 * 1000).length;
        setOrderCount(active);
        setLateCount(late);
      } catch {}
    };
    fetchCount();
    const unsub = onEvent('order:update', fetchCount);
    const onNameChange = (e: Event) => setAppName((e as CustomEvent).detail || 'Панель управления');
    window.addEventListener('app-name-changed', onNameChange);
    return () => { unsub(); window.removeEventListener('app-name-changed', onNameChange); };
  }, []);

  useEffect(() => {
    const allSubPages = menuConfig.flatMap(g =>
      g.items.flatMap(i => 'subItems' in i ? i.subItems.map(s => s.id) : [i.id])
    );
    for (const g of menuConfig) {
      for (const item of g.items) {
        if ('subItems' in item) {
          if (item.subItems.some(s => s.id === adminPage)) {
            setOpenParents(p => ({ ...p, [item.id]: true }));
            setOpenGroups(o => ({ ...o, [g.id]: true }));
          }
        } else if (item.id === adminPage) {
          setOpenGroups(o => ({ ...o, [g.id]: true }));
        }
      }
    }
  }, [adminPage]);

  const menuConfig: MenuGroup[] = [
    {
      id: 'operations', label: t('sidebar_operations'), icon: LayoutDashboard,
      roles: ['superadmin', 'owner', 'manager', 'analyst', 'waiter', 'chef', 'courier'],
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t('sidebar_dashboard') },
        { id: 'orders', icon: ShoppingBag, label: t('sidebar_orders'), badge: (active: any, late: any) => active > 0 ? { count: active, late } : null },
        { id: 'kitchen', icon: ChefHat, label: t('sidebar_kitchen') },
        { id: 'foh_display', icon: Monitor, label: 'Экран раздачи' },
        { id: 'bookings', icon: CalendarDays, label: t('sidebar_bookings') },
        { id: 'delivery', icon: Truck, label: t('sidebar_delivery') },
        { id: 'pickup_points', icon: MapPin, label: t('sidebar_pickup_points') },
        { id: 'chats', icon: MessageSquare, label: t('sidebar_chats') },
        { id: 'staff_chats', icon: MessageSquare, label: t('sidebar_staff_chats') },
        { id: 'courier_guest_chats', icon: MessageCircle, label: 'Чаты курьер-гость' },
      ]
    },
    {
      id: 'stock', label: t('sidebar_stock'), icon: Package,
      roles: ['superadmin', 'owner', 'manager', 'chef', 'accountant'],
      items: [
        {
          id: 'warehouse_group', icon: Warehouse, label: t('sidebar_warehouse'),
          subItems: [
            { id: 'inventory_items', icon: Package, label: t('sidebar_warehouse_items') },
            { id: 'stock_categories', icon: FolderTree, label: t('sidebar_warehouse_categories') },
            { id: 'warehouses', icon: Building2, label: t('sidebar_warehouses') },
            { id: 'workshops', icon: Factory, label: t('sidebar_workshops') },
            { id: 'counterparties', icon: Handshake, label: t('sidebar_counterparties') },
            { id: 'supplier_portal', icon: Globe, label: 'Портал поставщика' },
            { id: 'wholesale_prices', icon: Receipt, label: t('sidebar_wholesale_prices') },
            { id: 'barcodes', icon: Printer, label: 'Штрихкоды' },
          { id: 'forecast', icon: BarChart3, label: 'Прогнозы' },
          ]
        },
        { id: 'tech_cards', icon: FileText, label: t('sidebar_tech_cards') },
        {
          id: 'documents_group', icon: Files, label: t('sidebar_documents'),
          subItems: [
            { id: 'journal', icon: FileSpreadsheet, label: t('sidebar_doc_journal'), onClick: () => { setDocType('journal'); setAdminPage('documents'); } },
            { id: 'receipt', icon: ClipboardList, label: t('sidebar_doc_receipt'), onClick: () => { setDocType('receipt'); setAdminPage('documents'); } },
            { id: 'write_off', icon: PackageSearch, label: t('sidebar_doc_write_off'), onClick: () => { setDocType('write_off'); setAdminPage('documents'); } },
            { id: 'transfer', icon: ArrowLeftRight, label: t('sidebar_doc_transfer'), onClick: () => { setDocType('transfer'); setAdminPage('documents'); } },
            { id: 'inventory', icon: PackageSearch, label: t('sidebar_doc_inventory'), onClick: () => { setDocType('inventory'); setAdminPage('documents'); } },
            { id: 'production', icon: FlaskConical, label: t('sidebar_doc_production'), onClick: () => { setDocType('production'); setAdminPage('documents'); } },
            { id: 'return_', icon: ArrowDownUp, label: t('sidebar_doc_return'), onClick: () => { setDocType('return_'); setAdminPage('documents'); } },
            { id: 'shipment', icon: FileUp, label: t('sidebar_doc_shipment'), onClick: () => { setDocType('shipment'); setAdminPage('documents'); } },
            { id: 'breakdown', icon: Scissors, label: t('sidebar_doc_breakdown'), onClick: () => { setDocType('breakdown'); setAdminPage('documents'); } },
            { id: 'processing', icon: Cog, label: t('sidebar_doc_processing'), onClick: () => { setDocType('processing'); setAdminPage('documents'); } },
            { id: 'contractor_order', icon: ShoppingCart, label: t('sidebar_doc_contractor_order'), onClick: () => { setDocType('contractor_order'); setAdminPage('documents'); } },
            { id: 'auto_orders', icon: ShoppingCart, label: 'Автозаказы' },
            { id: 'auto_writeoff', icon: CalendarX, label: 'Списание (сроки годности)' },
            { id: 'costing', icon: Calculator, label: 'Калькуляция себестоимости' },
            { id: 'production_order', icon: Hammer, label: t('sidebar_doc_production_order'), onClick: () => { setDocType('production_order'); setAdminPage('documents'); } },
            { id: 'service', icon: HandshakeIcon, label: t('sidebar_doc_service'), onClick: () => { setDocType('service'); setAdminPage('documents'); } },
          ]
        },
      ]
    },
    {
      id: 'menu_clients', label: t('sidebar_menu_clients'), icon: BookOpen,
      roles: ['superadmin', 'owner', 'manager', 'chef', 'analyst'],
      items: [
        {
          id: 'menu_group', icon: BookOpen, label: t('sidebar_menu'),
          subItems: [
            { id: 'menu_items', icon: BookOpen, label: t('sidebar_menu_items') },
            { id: 'menu_categories', icon: FolderTree, label: t('sidebar_menu_categories') },
            { id: 'menu_modifiers', icon: Cog, label: t('sidebar_menu_modifiers') },
            { id: 'menu_modifier_groups', icon: FolderTree, label: t('sidebar_menu_modifier_groups') },
            { id: 'menu_price_lists', icon: Receipt, label: t('sidebar_menu_price_lists') },
            { id: 'menu_weekly_menu', icon: CalendarDays, label: t('sidebar_menu_weekly') },
            { id: 'menu_stop_lists', icon: PackageSearch, label: t('sidebar_menu_stop_lists') },
            { id: 'menu_languages', icon: Globe, label: t('sidebar_menu_languages') },
          ]
        },
        {
          id: 'clients_group', icon: Users, label: t('sidebar_clients_group'),
          subItems: [
            { id: 'clients', icon: Users, label: t('sidebar_clients_list') },
            { id: 'client_groups', icon: UsersRound, label: t('sidebar_client_groups') },
            { id: 'reviews', icon: MessageSquare, label: t('sidebar_reviews') },
            { id: 'review_questions', icon: MessageSquare, label: t('sidebar_review_questions') },
          ]
        },
      ]
    },
    {
      id: 'marketing', label: t('sidebar_marketing'), icon: Megaphone,
      roles: ['superadmin', 'owner', 'manager'],
      items: [
        { id: 'marketing', icon: Megaphone, label: t('sidebar_marketing_page') },
        { id: 'loyalty', icon: Award, label: 'Программа лояльности' },
        { id: 'gamification', icon: Gamepad2, label: 'Геймификация' },
        {
          id: 'messages_group', icon: MessageSquare, label: t('sidebar_messages'),
          subItems: [
            { id: 'messages', icon: MessageSquare, label: t('sidebar_messages_list') },
            { id: 'notifications', icon: Bell, label: t('sidebar_notifications') },
            { id: 'push_settings', icon: Settings, label: t('sidebar_push_settings') },
            { id: 'email_settings', icon: Mail, label: 'E-mail настройки' },
          ]
        },
      ]
    },
    {
      id: 'reports_group', label: 'Отчёты', icon: BarChart3,
      roles: ['superadmin', 'owner', 'manager', 'accountant', 'analyst'],
      items: [
        { id: 'reports', icon: BarChart3, label: 'Все отчёты' },
      ]
    },
    {
      id: 'finance_admin', label: t('sidebar_finance_admin'), icon: DollarSign,
      roles: ['superadmin', 'owner', 'manager', 'accountant', 'analyst'],
      items: [
        { id: 'finance', icon: DollarSign, label: t('sidebar_finance') },
        { id: 'tax_accounting', icon: Calculator, label: 'Налоговый учёт (НДС)' },
        { id: 'balance_sheet', icon: Wallet, label: 'Баланс (бухгалтерия)' },
        { id: 'bank_statement', icon: FileSpreadsheet, label: 'Выписки (сверка)' },
        { id: 'payments', icon: CreditCard, label: 'Платежи онлайн' },
        { id: 'salary', icon: Wallet, label: t('sidebar_salary') },
        { id: 'staff', icon: UsersRound, label: t('sidebar_staff') },
        { id: 'staff_schedule', icon: CalendarDays, label: 'График работы' },
        { id: 'payment_settings', icon: CreditCard, label: t('sidebar_payment') },
        {
          id: 'settings_group', icon: Settings, label: t('sidebar_settings_group'),
          subItems: [
            { id: 'settings', icon: Settings, label: t('sidebar_settings') },
            { id: 'franchising', icon: Building2, label: 'Франчайзинг' },
            { id: 'telegram_bot', icon: MessageCircle, label: 'Telegram Bot' },
            { id: 'app_management', icon: Smartphone, label: 'Настройки приложения' },
            { id: 'shifts', icon: DollarSign, label: 'Смены и Z-отчёт' },
            { id: 'fiscalization', icon: Printer, label: 'Фискализация (54-ФЗ)' },
            { id: 'terminal', icon: CreditCard, label: 'Эквайринг (терминалы)' },
            { id: 'theme_constructor', icon: Palette, label: 'Темы оформления' },
            { id: 'branding', icon: Palette, label: 'Брендирование' },
            { id: 'site_settings', icon: Globe, label: 'Веб-сайт' },
            { id: 'aggregators', icon: Globe, label: 'Агрегаторы доставки' },
            { id: 'yandex_afisha', icon: Calendar, label: 'Яндекс Афиша' },
            { id: 'integration_1c', icon: GitCompare, label: '1С' },
            { id: 'crm_integration', icon: GitCompare, label: 'CRM (amoCRM / Bitrix24)' },
            { id: 'honest_sign', icon: ShieldCheck, label: 'Честный знак' },
            { id: 'security', icon: Shield, label: 'Безопасность' },
            { id: 'audit', icon: Shield, label: t('sidebar_security') },
            { id: 'branches', icon: Building2, label: t('sidebar_branches') },
            { id: 'swagger_docs', icon: FileJson, label: 'API документация' },
            { id: 'telephony', icon: Phone, label: 'IP-телефония' },
            { id: 'telephony_operator', icon: PhoneCall, label: 'Оператор колл-центра' },
            { id: 'currency_settings', icon: Globe, label: 'Мультивалютность' },
          ]
        },
      ]
    },
    {
      id: 'references', label: t('sidebar_references'), icon: FolderTree,
      roles: ['superadmin', 'owner', 'manager', 'chef'],
      items: [
        { id: 'categories', icon: FolderTree, label: t('sidebar_categories') },
        { id: 'inventory', icon: PackageSearch, label: t('sidebar_inventory') },
      ]
    },
  ];

  const toggleGroup = (gid: string) => setOpenGroups(o => ({ ...o, [gid]: !o[gid] }));
  const toggleParent = (pid: string) => setOpenParents(p => ({ ...p, [pid]: !p[pid] }));

  const navigate = (page: string) => {
    if (page === 'documents') setAdminPage('documents');
    else setAdminPage(page as AdminPage);
  };

  const navSub = (sub: SubMenuItem) => {
    if (sub.onClick) sub.onClick();
    else setAdminPage(sub.id as AdminPage);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {open && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full z-40 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 w-64 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">F</div>
        <span className="font-bold text-zinc-900 dark:text-white">{appName}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 flex flex-col">
        {menuConfig.filter(g => !g.roles || g.roles.includes(adminRole)).map(group => {
          const isOpen = openGroups[group.id];
          const hasActive = group.items.some(i => {
            if ('subItems' in i) return i.subItems.some(s => s.id === adminPage || (s.id === 'documents' && adminPage === 'documents'));
            return i.id === adminPage;
          });
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
                  {group.items.filter(i => !i.roles || i.roles.includes(adminRole)).map(item => {
                    if ('subItems' in item) {
                      const parentOpen = openParents[item.id];
                      const hasActiveChild = item.subItems.some(s => s.id === adminPage);
                      return (
                        <div key={item.id}>
                          <button onClick={() => toggleParent(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${hasActiveChild ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                            <item.icon size={16} />
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown size={12} className={`transition-transform duration-200 ${parentOpen ? 'rotate-0' : '-rotate-90'}`} />
                          </button>
                          {parentOpen && (
                            <div className="ml-3 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5 mt-0.5 mb-0.5">
                              {item.subItems.map(sub => {
                                const pageId = sub.onClick ? 'documents' : sub.id;
                                const isActive = sub.onClick ? (adminPage === 'documents' && getDocType() === sub.id) : adminPage === sub.id;
                                return (
                                  <button key={sub.id} onClick={() => navSub(sub)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                                    <sub.icon size={14} />
                                    <span className="flex-1 text-left">{sub.label}</span>
                                    {sub.id === 'clients' && registeredUsers.length > 0 && (
                                      <span className="bg-indigo-500 text-white text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold">{registeredUsers.length}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    const pageId = item.id;
                    const isActive = adminPage === pageId;
                    const badgeInfo = item.badge?.(orderCount, lateCount, registeredUsers.length);
                    return (
                      <button key={item.id} onClick={() => navigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                        <item.icon size={16} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {badgeInfo && (
                          <span className={`text-white text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold ${badgeInfo.late ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`}>
                            {badgeInfo.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-auto pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3">Приложения</p>
          <button onClick={() => setAdminPage('extensions')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${adminPage === 'extensions' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <Puzzle size={14} />
            <span className="flex-1 text-left">Магазин приложений</span>
          </button>
          <button onClick={() => setAdminPage('extensions_sdk')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${adminPage === 'extensions_sdk' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <Code size={14} />
            <span className="flex-1 text-left">SDK для разработчиков</span>
          </button>
          <a href="/admin/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-[0.97]">
            <LayoutDashboard size={14} />
            <span className="flex-1 text-left">Admin</span>
          </a>
          <a href="/guest/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-500 transition-all active:scale-[0.97]">
            <ShoppingBag size={14} />
            <span className="flex-1 text-left">Guest</span>
          </a>
          <a href="/waiter/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-500 transition-all active:scale-[0.97]">
            <BookOpen size={14} />
            <span className="flex-1 text-left">Waiter</span>
          </a>
          <a href="/kitchen/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 transition-all active:scale-[0.97]">
            <ChefHat size={14} />
            <span className="flex-1 text-left">Kitchen</span>
          </a>
          <a href="/courier/" target="_blank"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-purple-500 transition-all active:scale-[0.97]">
            <Truck size={14} />
            <span className="flex-1 text-left">Courier</span>
          </a>
          <div className="pt-1">
            <a href="/portal/" target="_blank"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 transition-all active:scale-[0.97]">
              <Globe size={14} />
              <span className="flex-1 text-left">Portal</span>
            </a>
          </div>
        </div>
      </nav>
    </aside>
    </>
  );
}

function TopBar({ onLogout, onRefresh, onMenuToggle }: { onLogout?: () => void; onRefresh?: () => void; onMenuToggle?: () => void }) {
  const { theme, toggleTheme, notifications, unreadCount, clearNotifications, setAdminPage, fontSize, setFontSize } = useApp();
  const { t, i18n } = useTranslation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowSearch(false); } };
    document.addEventListener('mousedown', handler);
    const keyHandler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchInputRef.current?.focus(); } };
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, []);

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults(null); return; }
    setSearching(true);
    try { setSearchResults(await api.globalSearch(q)); } catch { setSearchResults(null); } finally { setSearching(false); }
  };

  const goTo = (page: string, id?: number) => {
    setShowSearch(false); setSearchQuery(''); setSearchResults(null);
    if (id) localStorage.setItem('_focusId', String(id));
    setAdminPage(page as any);
  };

  return (
    <div className="shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-6 h-16 flex items-center justify-end gap-2 md:gap-4">
      <button onClick={onMenuToggle} className="md:hidden p-2 text-zinc-500 hover:text-zinc-700 transition active:scale-[0.97] mr-2"><MenuIcon size={20} /></button>
      <div ref={searchRef} className="relative flex-1 max-w-md mr-auto">
        <input ref={searchInputRef} value={searchQuery} onChange={e => doSearch(e.target.value)} onFocus={() => setShowSearch(true)}
          placeholder={t('topbar_search_placeholder')}
          className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
        {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
        {showSearch && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl max-h-96 overflow-y-auto z-50">
            {searchResults.orders?.length > 0 && <SearchGroup title={t('search_orders')} icon={ShoppingBag} items={searchResults.orders.map((o: any) => ({ label: `#${o.id} — ${o.user_name || ''} (${o.total}₽) ${o.status}`, onClick: () => goTo('orders', o.id) }))} />}
            {searchResults.dishes?.length > 0 && <SearchGroup title={t('search_dishes')} icon={BookOpen} items={searchResults.dishes.map((d: any) => ({ label: `${d.name} — ${d.price}₽`, onClick: () => goTo('menu_items', d.id) }))} />}
            {searchResults.items?.length > 0 && <SearchGroup title={t('search_items')} icon={Package} items={searchResults.items.map((i: any) => ({ label: `${i.name} (${i.article || ''}) — ост. ${i.current_stock}`, onClick: () => goTo('inventory_items', i.id) }))} />}
            {searchResults.clients?.length > 0 && <SearchGroup title={t('search_clients')} icon={Users} items={searchResults.clients.map((c: any) => ({ label: `${c.name} — ${c.phone}`, onClick: () => goTo('clients', c.id) }))} />}
            {searchResults.staff?.length > 0 && <SearchGroup title={t('search_staff')} icon={UsersRound} items={searchResults.staff.map((s: any) => ({ label: `${s.first_name} ${s.last_name || ''} — ${s.role}`, onClick: () => goTo('staff', s.id) }))} />}
            {searchResults.documents?.length > 0 && <SearchGroup title={t('search_documents')} icon={Files} items={searchResults.documents.map((d: any) => ({ label: `#${d.number || d.id} (${d.type})`, onClick: () => goTo('documents', d.id) }))} />}
            {!searchResults.orders?.length && !searchResults.dishes?.length && !searchResults.items?.length && !searchResults.clients?.length && !searchResults.staff?.length && !searchResults.documents?.length && (
              <div className="p-6 text-center text-sm text-zinc-400">{t('search_none')}</div>
            )}
          </div>
        )}
      </div>
      <button onClick={onRefresh} className="p-2 text-zinc-500 hover:text-blue-500 transition active:scale-[0.97]" title={t('topbar_refresh')}>
        <RefreshCw size={20} />
      </button>
      <div className="relative">
        <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 text-zinc-500 hover:text-zinc-700 transition active:scale-[0.97]">
          <Bell size={20} />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />}
        </button>
        {showNotifs && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 rounded-2xl shadow-xl z-50">
            <div className="p-3 border-b border-zinc-100 flex justify-between"><h3 className="font-bold text-sm">{t('topbar_notifications')}</h3><button onClick={clearNotifications} className="text-xs text-orange-500">{t('topbar_clear')}</button></div>
            <div className="max-h-80 overflow-y-auto p-2">
              {notifications.length === 0 ? <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-6">{t('topbar_no_notifications')}</p> : notifications.slice(0, 10).map(n => <div key={n.id} className="p-2.5 border-b border-zinc-100 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg"><p className="text-sm font-semibold text-zinc-900 dark:text-white">{n.title}</p>{n.body && <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">{n.body}</p>}</div>)}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-0.5" title="Размер текста">
        {(['small','medium','large'] as const).map(s => {
          const active = fontSize === s;
          const sz = { small: '11px', medium: '14px', large: '17px' };
          const hints = { small: 'Мелкий', medium: 'Средний', large: 'Крупный' };
          return (
            <button key={s} onClick={() => setFontSize(s)} title={hints[s]}
              className={`px-2 py-1 rounded-md font-bold transition-all ${active ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800'}`}
              style={{ fontSize: sz[s] }}>A</button>
          );
        })}
      </div>
      <LanguageSelector />
      <ThemeSelector />
      <button onClick={onLogout} className="p-2 text-zinc-500 hover:text-red-500 transition active:scale-[0.97]"><LogOut size={20} /></button>
    </div>
  );
}

function SearchGroup({ title, icon: Icon, items }: { title: string; icon: any; items: { label: string; onClick: () => void }[] }) {
  return (
    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1"><Icon size={12} /> {title}</p>
      {items.map((item, i) => (
        <button key={i} onClick={item.onClick}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.98]">
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{title}</h2>
        <p className="text-zinc-500 dark:text-zinc-400">Страница в разработке</p>
      </div>
    </div>
  );
}
