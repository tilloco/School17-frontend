import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth-context';
import { openSocket } from './socket';

type Handler = (payload: unknown) => void;
interface Ctx { subscribe: (event: string, h: Handler) => () => void; live: boolean }
const RealtimeContext = createContext<Ctx>({ subscribe: () => () => undefined, live: false });

const EVENTS = ['message', 'receipt', 'class.channel', 'class:chat', 'class:poll', 'class:present', 'class:whiteboard'];

/** Keeps one live connection while signed in. Screens listen with useRealtime(); "connect" fires on every (re)connection so they can catch up. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const handlers = useRef(new Map<string, Set<Handler>>());
  const [live, setLive] = useState(false);

  const emit = (event: string, payload?: unknown) => handlers.current.get(event)?.forEach((h) => { try { h(payload); } catch { /* one screen must not break the others */ } });

  useEffect(() => {
    if (!token) return;
    const s = openSocket(token);
    s.on('connect', () => { setLive(true); emit('connect'); });
    s.on('disconnect', () => setLive(false));
    for (const e of EVENTS) s.on(e, (p: unknown) => emit(e, p));
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { if (!s.connected) s.connect(); emit('connect'); } });
    return () => { sub.remove(); s.disconnect(); setLive(false); };
  }, [token]);

  const subscribe = React.useCallback((event: string, h: Handler) => {
    const set = handlers.current.get(event) ?? new Set<Handler>();
    set.add(h); handlers.current.set(event, set);
    return () => { set.delete(h); };
  }, []);
  const value = React.useMemo(() => ({ subscribe, live }), [subscribe, live]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Run `cb` when any of the events arrives (or the connection comes back). */
export function useRealtime(events: string[], cb: (payload: unknown) => void) {
  const { subscribe } = useContext(RealtimeContext);
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const offs = events.map((e) => subscribe(e, (p) => ref.current(p)));
    return () => offs.forEach((o) => o());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, events.join('|')]);
}

export const useRealtimeLive = () => useContext(RealtimeContext).live;
