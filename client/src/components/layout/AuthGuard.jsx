import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Skeleton } from '../ui/Skeleton';

/**
 * Wraps all protected routes (inside AppLayout).
 *
 * Three states:
 *  1. loading  → render a full-screen skeleton while the /me check is in flight
 *  2. no user  → redirect to /login (covers both 401 and null session)
 *  3. user ok  → render the child routes via <Outlet />
 *
 * @returns {JSX.Element}
 */
export function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-gray-900 flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl mt-2" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
