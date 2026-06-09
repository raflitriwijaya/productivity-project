// client/src/hooks/useApi.js
// Generic data-fetching hook (§6.8). Returns { data, loading, error, refetch }.
// All page data fetching goes through this — never useEffect+axios directly in
// pages (§10 NEVER #7).
//
// Race-condition guard (hardening 3B-2): an isMounted ref prevents a setState
// on an unmounted component when the user navigates away mid-flight. `refetch`
// keeps a stable identity (deps-driven) per the §6.8 contract.

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @template T
 * @param {() => Promise<{ data: T }>} fetchFn  Returns the unwrapped envelope (api.js interceptor).
 * @param {React.DependencyList} [deps=[]]       Re-run the fetch when these change.
 * @returns {{ data: T|null, loading: boolean, error: string|null, refetch: () => Promise<void> }}
 */
export function useApi(fetchFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Phase 4: callers pass a literal array at the call site; spreading here is intentional.
  // Suppress: use-memo (non-literal deps array) and exhaustive-deps (fetchFn intentionally excluded).
  /* eslint-disable react-hooks/use-memo, react-hooks/exhaustive-deps */
  const execute = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetchFn();
      if (isMounted.current) setState({ data: result.data, loading: false, error: null });
    } catch (err) {
      if (isMounted.current) setState({ data: null, loading: false, error: err.message });
    }
  }, deps);
  /* eslint-enable react-hooks/use-memo, react-hooks/exhaustive-deps */

  useEffect(() => { execute(); }, [execute]);

  return { ...state, refetch: execute };
}
