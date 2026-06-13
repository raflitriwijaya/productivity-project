import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthGuard } from './components/layout/AuthGuard';
import { Card, CardBody } from './components/ui/Card';
import { ListSkeleton } from './components/ui/Skeleton';
import TodayDashboard from './pages/TodayDashboard';
import Dashboard from './pages/Dashboard';
import Todo from './pages/Todo';
import Finance from './pages/Finance';
import FinanceDashboard from './pages/FinanceDashboard';
import Accounts from './pages/Accounts';
import Receivables from './pages/Receivables';
import Payables from './pages/Payables';
import Portfolio from './pages/Portfolio';
import Budget from './pages/Budget';
const FinanceOverview = lazy(() => import('./pages/FinanceOverview'));
const EngineerSprint  = lazy(() => import('./pages/EngineerSprint'));
import Learning from './pages/Learning';
import Reading from './pages/Reading';
import Contacts from './pages/Contacts';
import Ideas from './pages/Ideas';
import WeeklyReview from './pages/WeeklyReview';
import Goals from './pages/Goals';
import AnnualReport from './pages/AnnualReport';
import PolymathDashboard from './pages/PolymathDashboard';
import AIChat from './pages/AIChat';
import Login from './pages/Login';
import Register from './pages/Register';

// Code-split routes: the Engineering Toolkit pages (Docs editor, Snippets/Project
// Detail highlighter) AND the Research page all pull in the heavy
// `@uiw/react-md-editor` and/or `prism-react-renderer`. Lazy-loading them (Phase 11
// also lazy-loaded Research) keeps those vendor chunks out of the main bundle so
// they download only when one of those routes is first visited.
const Research              = lazy(() => import('./pages/Research'));
const EngineerProjects      = lazy(() => import('./pages/EngineerProjects'));
const EngineerProjectDetail = lazy(() => import('./pages/EngineerProjectDetail'));
const EngineerSnippets      = lazy(() => import('./pages/EngineerSnippets'));
const EngineerDocs          = lazy(() => import('./pages/EngineerDocs'));
const EngineerCheckins      = lazy(() => import('./pages/EngineerCheckins'));
const EngineerIssues        = lazy(() => import('./pages/EngineerIssues'));
const EngineerRoadmap       = lazy(() => import('./pages/EngineerRoadmap'));

/**
 * Suspense fallback for lazily-loaded pages. Matches the page content shape with
 * a skeleton (never a spinner — §10 NEVER #14). The sidebar/frame stays mounted
 * because this renders inside <AppLayout>'s <Outlet />.
 */
function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-80 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
      </div>
      <Card>
        <CardBody className="p-0">
          <ListSkeleton rows={6} />
        </CardBody>
      </Card>
    </div>
  );
}

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
 *        /           → TodayDashboard (Wave 2 daily briefing)
 *        /dashboard  → Dashboard (legacy lifetime statistics)
 *        /todo       → Todo
 *        /finance    → Finance (+ sub-pages)
 *        /research   → Research
 *        /learning   → Learning
 *        /engineer   → Engineering Toolkit (+ sub-pages, lazy-loaded)
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
            <Route path="/" element={<TodayDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/finance/overview" element={<Suspense fallback={<PageFallback />}><FinanceOverview /></Suspense>} />
            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route path="/finance/accounts" element={<Accounts />} />
            <Route path="/finance/receivables" element={<Receivables />} />
            <Route path="/finance/payables" element={<Payables />} />
            <Route path="/finance/portfolio" element={<Portfolio />} />
            <Route path="/finance/budget" element={<Budget />} />
            <Route path="/research" element={<Suspense fallback={<PageFallback />}><Research /></Suspense>} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/reading" element={<Reading />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/ideas" element={<Ideas />} />

            {/* Reflect & Grow (Roadmap Wave 5) */}
            <Route path="/review" element={<WeeklyReview />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/report" element={<AnnualReport />} />
            <Route path="/polymath" element={<PolymathDashboard />} />

            {/* Engineering Toolkit — lazy-loaded. Literal sub-routes precede the
                dynamic /engineer/:id detail route so static segments match first.
                Each element is wrapped in <Suspense> so the skeleton shows while
                the route's chunk (and its editor/prism deps) downloads. */}
            <Route path="/engineer"          element={<Suspense fallback={<PageFallback />}><EngineerProjects /></Suspense>} />
            <Route path="/engineer/sprint"   element={<Suspense fallback={<PageFallback />}><EngineerSprint /></Suspense>} />
            <Route path="/engineer/snippets" element={<Suspense fallback={<PageFallback />}><EngineerSnippets /></Suspense>} />
            <Route path="/engineer/docs"     element={<Suspense fallback={<PageFallback />}><EngineerDocs /></Suspense>} />
            <Route path="/engineer/checkins" element={<Suspense fallback={<PageFallback />}><EngineerCheckins /></Suspense>} />
            <Route path="/engineer/issues"   element={<Suspense fallback={<PageFallback />}><EngineerIssues /></Suspense>} />
            <Route path="/engineer/roadmap"  element={<Suspense fallback={<PageFallback />}><EngineerRoadmap /></Suspense>} />
            <Route path="/engineer/:id"      element={<Suspense fallback={<PageFallback />}><EngineerProjectDetail /></Suspense>} />
          </Route>
        </Route>

        {/* Catch-all: unknown paths fall back to dashboard (AuthGuard will redirect to /login if needed) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
