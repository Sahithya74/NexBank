import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Wallet from './pages/Wallet';
import Transfers from './pages/Transfers';
import Transactions from './pages/Transactions';
import Bills from './pages/Bills';
import Cards from './pages/Cards';
import Loans from './pages/Loans';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import AdminDashboard from './pages/admin/AdminDashboard';
import Users from './pages/admin/Users';
import Roles from './pages/admin/Roles';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminWallets from './pages/admin/AdminWallets';
import AdminLoans from './pages/admin/AdminLoans';
import AuditLogs from './pages/admin/AuditLogs';
import Reports from './pages/admin/Reports';

/**
 * Route table. Every protected route names the permission it needs; the same
 * permission is enforced independently by the API on each request.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/accounts"
          element={<ProtectedRoute permission="account.view.own"><Accounts /></ProtectedRoute>}
        />
        <Route
          path="/wallet"
          element={<ProtectedRoute permission="wallet.view.own"><Wallet /></ProtectedRoute>}
        />
        <Route
          path="/transfers"
          element={<ProtectedRoute permission="transfer.create"><Transfers /></ProtectedRoute>}
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute permission={['transaction.view.own', 'transaction.view.all']}>
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route path="/bills" element={<ProtectedRoute permission="bill.pay"><Bills /></ProtectedRoute>} />
        <Route path="/cards" element={<ProtectedRoute permission="card.view"><Cards /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute permission="loan.view.own"><Loans /></ProtectedRoute>} />
        <Route
          path="/notifications"
          element={<ProtectedRoute permission="notification.view"><Notifications /></ProtectedRoute>}
        />
        <Route path="/settings" element={<Settings />} />

        <Route
          path="/admin"
          element={<ProtectedRoute permission="admin.dashboard"><AdminDashboard /></ProtectedRoute>}
        />
        <Route path="/admin/users" element={<ProtectedRoute permission="user.view"><Users /></ProtectedRoute>} />
        <Route path="/admin/roles" element={<ProtectedRoute permission="role.view"><Roles /></ProtectedRoute>} />
        <Route
          path="/admin/accounts"
          element={
            <ProtectedRoute permission={['account.view.all', 'account.view.assigned']}>
              <AdminAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute permission={['transaction.view.all', 'transaction.view.assigned']}>
              <AdminTransactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/wallets"
          element={<ProtectedRoute permission="wallet.view.all"><AdminWallets /></ProtectedRoute>}
        />
        <Route
          path="/admin/loans"
          element={<ProtectedRoute permission="loan.view.all"><AdminLoans /></ProtectedRoute>}
        />
        <Route
          path="/admin/audit-logs"
          element={<ProtectedRoute permission="audit.view"><AuditLogs /></ProtectedRoute>}
        />
        <Route
          path="/admin/reports"
          element={<ProtectedRoute permission="report.view"><Reports /></ProtectedRoute>}
        />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
