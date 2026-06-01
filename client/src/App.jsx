import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthGuard } from './components/layout/AuthGuard';
import Dashboard from './pages/Dashboard';
import Todo from './pages/Todo';
import Finance from './pages/Finance';
import FinanceDashboard from './pages/FinanceDashboard';
import Accounts from './pages/Accounts';
import Receivables from './pages/Receivables';
import Payables from './pages/Payables';
import Portfolio from './pages/Portfolio';
import Budget from './pages/Budget';
import Research from './pages/Research';
import Learning from './pages/Learning';
import Login from './pages/Login';
import Register from './pages/Register';

/**
 * Route structure:
 *
 *  Public (no auth):
 *    /login    → Login
 *    /register → Register
 *
 *  Protected (requires active session):
 *    AppLayout (sidebar + frame)
 *      AuthGuard (checks GET /api/auth/me; redirects to /login on failure)
 *        /           → Dashboard
 *        /todo       → Todo
 *        /finance    → Finance
 *        /research   → Research
 *        /learning   → Learning
 *
 *  Catch-all:
 *    *  → redirect to /
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes — no AppLayout, no AuthGuard */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — AppLayout owns the visual frame; AuthGuard owns the session check */}
        <Route element={<AppLayout />}>
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route path="/finance/accounts" element={<Accounts />} />
            <Route path="/finance/receivables" element={<Receivables />} />
            <Route path="/finance/payables" element={<Payables />} />
            <Route path="/finance/portfolio" element={<Portfolio />} />
            <Route path="/finance/budget" element={<Budget />} />
            <Route path="/research" element={<Research />} />
            <Route path="/learning" element={<Learning />} />
          </Route>
        </Route>

        {/* Catch-all: unknown paths fall back to dashboard (AuthGuard will redirect to /login if needed) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
