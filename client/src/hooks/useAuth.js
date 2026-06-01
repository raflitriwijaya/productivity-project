import { useApi } from './useApi';
import api from '../lib/api';

/**
 * Returns the currently authenticated user by calling GET /api/auth/me.
 *
 * @returns {{ user: object|null, loading: boolean, error: string|null }}
 *
 * - `loading: true`  → session check in flight; render nothing or a skeleton
 * - `user: null, loading: false` → no active session (401 was caught as error)
 * - `user: object, loading: false` → authenticated; shape: { id, name, email }
 *
 * The api.js interceptor converts 401 responses into a rejected Promise with
 * message "Authentication required." — useApi catches that into `error`, so
 * AuthGuard treats error === no session and redirects to /login.
 */
export function useAuth() {
  const { data: user, loading, error } = useApi(() => api.get('/api/auth/me'));

  return { user: user ?? null, loading, error };
}
