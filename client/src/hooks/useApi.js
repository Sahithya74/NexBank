import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

/**
 * Data fetching with the four states every NexBank page must handle:
 * loading, error, empty and success. `reload` re-runs the request in place.
 */
export function useApiQuery(path, { params, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const mounted = useRef(true);

  const serialisedParams = JSON.stringify(params ?? null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return null;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const result = await api.get(path, { params: params ?? undefined });
        if (mounted.current) setData(result);
        return result;
      } catch (caught) {
        if (mounted.current) setError(caught);
        return null;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, serialisedParams, enabled],
  );

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { data, error, loading, reload: run, setData };
}

/** Wraps a mutating call with pending state and consistent error capture. */
export function useMutation(handler) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        return await handler(...args);
      } catch (caught) {
        setError(caught);
        throw caught;
      } finally {
        setPending(false);
      }
    },
    [handler],
  );

  return { mutate, pending, error, clearError: () => setError(null) };
}

/** Debounces a rapidly changing value, used for search inputs. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
