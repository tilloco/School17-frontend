import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, captureGets } from '../lib/api';
import type { ViewState } from '../components/StateView';
import { onReconnect } from '../lib/connection';

export interface AsyncState<T> {
  data: T | null;
  state: ViewState | 'ready';
  error: string | null;
  reload: () => void;
}

/** Last good result of each screen's requests: opening a screen again shows it at once while the fresh data loads behind it. */
const remembered = new Map<string, unknown>();
const MAX_REMEMBERED = 150;
export function forgetScreens() { remembered.clear(); }

/** ApiError.statusCode === 0 — tarmoq xatosi yoki taymaut: ekranlarda "oflayn" holati ko'rsatiladi. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], isEmpty?: (d: T) => boolean): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<AsyncState<T>['state']>('loading');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const hasData = useRef(false);
  const depKey = useRef('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    alive.current = true;
    const key = JSON.stringify(deps);
    if (key !== depKey.current) { depKey.current = key; hasData.current = false; } // different inputs: the old data is not valid any more
    const { result, keys } = captureGets(fn);
    const memo = keys.length ? keys.join('&') : null;
    if (!hasData.current && memo && remembered.has(memo)) {
      const d = remembered.get(memo) as T;
      hasData.current = true;
      setData(d);
      setError(null);
      setState(isEmpty?.(d) ? 'empty' : 'ready');
    } else if (!hasData.current) setState('loading'); // a refresh keeps showing the old data instead of flashing a spinner
    result
      .then((d) => {
        if (!alive.current) return;
        hasData.current = true;
        if (memo) {
          remembered.delete(memo);
          remembered.set(memo, d);
          if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value as string);
        }
        setData(d);
        setError(null);
        setState(isEmpty?.(d) ? 'empty' : 'ready');
      })
      .catch((e) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : String(e));
        if (hasData.current) return; // keep the last good data on screen; the connection banner tells the person what is going on
        setState(e instanceof ApiError && e.statusCode === 0 ? 'offline' : 'error');
      });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  // when the connection returns, a screen that failed to load tries again by itself
  useEffect(() => (state === 'offline' || state === 'error' ? onReconnect(reload) : undefined), [state, reload]);
  return { data, state, error, reload };
}
