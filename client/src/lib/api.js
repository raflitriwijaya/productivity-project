import axios from 'axios';

/**
 * Axios instance — single API client for the entire app.
 *
 * Interceptor behaviour (§6.7):
 *  - Success: unwraps `response.data` so callers receive `{ success, data, meta }` directly
 *  - 401:     session expired or missing → hard-redirect to /login and reject
 *  - Other errors: extract the server's error message and reject with it
 *
 * withCredentials: true is required so the httpOnly session cookie (named "sid") is
 * sent cross-origin during development (client :5173 → server :3000).
 */
// Phase 4: fail fast in production builds if the API URL env var is missing
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is required in production. Set it in your deployment environment.');
}

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
//   headers: { 'Content-Type': 'application/json' },
//   withCredentials: true,
// });

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  // Hapus Content-Type default — biarkan axios auto-detect
  // FormData akan otomatis jadi multipart/form-data
  // JSON body akan otomatis jadi application/json
});

api.interceptors.response.use(
  // Unwrap the standard response envelope (§6.4)
  (response) => response.data,

  (error) => {
    const status = error.response?.status;

    // Global 401 handler — session is gone; send user to login.
    // Guard against redirect loops: don't redirect if already on /login or /register.
    if (status === 401) {
      const { pathname } = window.location;
      if (pathname !== '/login' && pathname !== '/register') {
        window.location.replace('/login');
      }
    }

    // Phase 6: a 429 is rate-limiting, NOT an auth failure. Do NOT redirect to
    // /login (that page shares a limiter and would deepen the lockout). Surface
    // the server's "slow down" message and let the caller show a toast.
    const message =
      error.response?.data?.error?.message ||
      (status === 429
        ? "You're doing that too fast — please wait a moment and try again."
        : 'An unexpected error occurred.');

    // Phase 6: attach the HTTP status so callers (e.g. useAuth) can distinguish
    // 429 (throttled) from 401 (unauthenticated) instead of nulling the session.
    const err = new Error(message);
    err.status = status;
    return Promise.reject(err);
  }
);

export default api;
