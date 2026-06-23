import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Tariffs } from './pages/Tariffs';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ImportPage } from './pages/ImportPage';
import { StaffAccounts } from './pages/StaffAccounts';
import { Branches } from './pages/Branches';
import { Subscription } from './pages/Subscription';
import { Payments } from './pages/Payments';
import { AdminTenants } from './pages/AdminTenants';
import { AdminTariffs } from './pages/AdminTariffs';
import { AdminNotifications } from './pages/AdminNotifications';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminTickets } from './pages/AdminTickets';
import { AdminMonitoring } from './pages/AdminMonitoring';
import { AdminAudit } from './pages/AdminAudit';
import { AdminBranding } from './pages/AdminBranding';
import { AdminGlobalSearch } from './pages/AdminGlobalSearch';
import { AdminInvoices } from './pages/AdminInvoices';
import { AdminTemplates } from './pages/AdminTemplates';
import { AdminExchangeRates } from './pages/AdminExchangeRates';
import { AdminSubscriptions } from './pages/AdminSubscriptions';
import { AdminPaymentProviders } from './pages/AdminPaymentProviders';
import { Features } from './pages/Features';
import { Pricing } from './pages/Pricing';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Apps } from './pages/Apps';
import { Integrations } from './pages/Integrations';
import { Finance } from './pages/Finance';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Layout><Features /></Layout>} />
        <Route path="/apps" element={<Layout><Apps /></Layout>} />
        <Route path="/integrations" element={<Layout><Integrations /></Layout>} />
        <Route path="/finance" element={<Layout><Finance /></Layout>} />
        <Route path="/pricing" element={<Layout><Pricing /></Layout>} />
        <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />
        <Route path="/tariffs" element={<Layout><Tariffs /></Layout>} />
        <Route path="/login" element={<Layout><Login /></Layout>} />
        <Route path="/register" element={<Layout><Register /></Layout>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><Layout><ImportPage /></Layout></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute><Layout><StaffAccounts /></Layout></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute><Layout><Branches /></Layout></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Layout><Subscription /></Layout></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Layout><Payments /></Layout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
        <Route path="/admin/tenants" element={<ProtectedRoute requireAdmin><Layout><AdminTenants /></Layout></ProtectedRoute>} />
        <Route path="/admin/tariffs" element={<ProtectedRoute requireAdmin><Layout><AdminTariffs /></Layout></ProtectedRoute>} />
        <Route path="/admin/notifications" element={<ProtectedRoute requireAdmin><Layout><AdminNotifications /></Layout></ProtectedRoute>} />
        <Route path="/admin/tickets" element={<ProtectedRoute requireAdmin><Layout><AdminTickets /></Layout></ProtectedRoute>} />
        <Route path="/admin/monitoring" element={<ProtectedRoute requireAdmin><Layout><AdminMonitoring /></Layout></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute requireAdmin><Layout><AdminAudit /></Layout></ProtectedRoute>} />
        <Route path="/admin/branding" element={<ProtectedRoute requireAdmin><Layout><AdminBranding /></Layout></ProtectedRoute>} />
        <Route path="/admin/search" element={<ProtectedRoute requireAdmin><Layout><AdminGlobalSearch /></Layout></ProtectedRoute>} />
        <Route path="/admin/invoices" element={<ProtectedRoute requireAdmin><Layout><AdminInvoices /></Layout></ProtectedRoute>} />
        <Route path="/admin/templates" element={<ProtectedRoute requireAdmin><Layout><AdminTemplates /></Layout></ProtectedRoute>} />
        <Route path="/admin/exchange-rates" element={<ProtectedRoute requireAdmin><Layout><AdminExchangeRates /></Layout></ProtectedRoute>} />
        <Route path="/admin/subscriptions" element={<ProtectedRoute requireAdmin><Layout><AdminSubscriptions /></Layout></ProtectedRoute>} />
        <Route path="/admin/payment-providers" element={<ProtectedRoute requireAdmin><Layout><AdminPaymentProviders /></Layout></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
