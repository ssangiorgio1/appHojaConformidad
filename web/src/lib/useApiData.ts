'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';

// Small data-fetching helper shared by the dashboard pages: runs `fn` with a
// fresh ID token whenever the (JSON-serialized) `deps` change, and exposes a
// `refetch` for actions (e.g. the Usuarios page re-listing after a PATCH).
//
// `fn`/`getIdToken` are read through refs rather than listed as dependencies
// so the effect's array can stay a genuine literal — eslint-plugin-react-hooks
// (React Compiler-era) requires that statically, and this hook's whole point
// is to accept a caller-supplied deps array, which it can't otherwise satisfy.
export function useApiData<T>(fn: (idToken: string) => Promise<T>, deps: unknown[]) {
  const { getIdToken } = useAuth();
  const fnRef = useRef(fn);
  const getIdTokenRef = useRef(getIdToken);
  useEffect(() => {
    fnRef.current = fn;
    getIdTokenRef.current = getIdToken;
  });

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against out-of-order responses: if the user changes filters again
  // before an earlier request resolves, only the latest request is allowed
  // to write its result into state.
  const requestId = useRef(0);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdTokenRef.current();
      const result = await fnRef.current(token);
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError((err as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this IS the fetch-on-deps-change effect
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `depsKey` stands in for the caller's own deps array
  }, [depsKey]);

  return { data, error, loading, refetch: run };
}
