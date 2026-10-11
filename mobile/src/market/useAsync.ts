import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import type { ViewState } from '../components/StateView';

export interface AsyncState<T> {
  data: T | null;
  state: ViewState | 'ready';
  error: string | null;
  reload: () => void;
}

/** ApiError.statusCode === 0 — tarmoq xatosi yoki taymaut: ekranlarda "oflayn" holati ko'rsatiladi. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], isEmpty?: (d: T) => boolean): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<AsyncState<T>['state']>('loading');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    alive.current = true;
    setState('loading');
    fn()
      .then((d) => {
        if (!alive.current) return;
        setData(d);
        setError(null);
        setState(isEmpty?.(d) ? 'empty' : 'ready');
      })
      .catch((e) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : String(e));
        setState(e instanceof ApiError && e.statusCode === 0 ? 'offline' : 'error');
      });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, state, error, reload };
}
