import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import { callApi, CallLobby, CallSummary } from './callApi';
import { CallContext, CallEvent, Effect, initialContext, POLICY, reduce } from './call-machine';
import { createRtcDriver, RtcDriver, rtcAvailability } from './rtc';

export interface ChatLine {
  id: number;
  mine: boolean;
  text: string;
}

/**
 * Qo'ng'iroq mantiqi: sof holat mashinasi (call-machine) + haqiqiy drayver (rtc.ts) + server presence.
 * Mashina nima qilishni aytadi (effektlar), bu hook esa ularni bajaradi.
 * HOLAT: UNTESTED qurilmada. Mashina va server tomoni testlangan; drayver bilan ulanish tekshirilmagan.
 */
export function useCall(bookingId: string, token: string | null) {
  const [ctx, dispatchRaw] = useReducer((c: CallContext, e: CallEvent) => reduce(c, e).ctx, initialContext());
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const [lobby, setLobby] = useState<CallLobby | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState<unknown | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const driver = useRef<RtcDriver | null>(null);
  const timers = useRef<{ hb?: ReturnType<typeof setInterval>; rc?: ReturnType<typeof setTimeout>; win?: ReturnType<typeof setInterval> }>({});
  const clockSkew = useRef(0); // server vaqti - qurilma vaqti
  const lineId = useRef(0);

  const availability = rtcAvailability();

  const loadLobby = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const t0 = Date.now();
      const l = await callApi.lobby(token, bookingId);
      clockSkew.current = new Date(l.serverTime).getTime() - (t0 + (Date.now() - t0) / 2);
      setLobby(l);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'error');
    }
  }, [bookingId, token]);

  useEffect(() => {
    void loadLobby();
  }, [loadLobby]);

  const finish = useCallback(async () => {
    if (!token) return;
    try {
      setSummary(await callApi.end(token, bookingId));
    } catch {
      /* summary keyin qayta so'raladi */
    }
  }, [bookingId, token]);

  // Mashina effektlarini bajaruvchi
  const run = useCallback(
    (effects: Effect[]) => {
      for (const e of effects) {
        switch (e.type) {
          case 'connect':
          case 'tryReconnect':
            void connect(e.type === 'tryReconnect');
            break;
          case 'scheduleReconnect':
            clearTimeout(timers.current.rc);
            timers.current.rc = setTimeout(() => send({ type: 'RECONNECT_TICK', now: Date.now() }), e.delayMs);
            break;
          case 'disconnect':
            void driver.current?.disconnect();
            break;
          case 'setMicPublishing':
            void driver.current?.setMic(e.on);
            break;
          case 'setCameraPublishing':
            void driver.current?.setCamera(e.on);
            break;
          case 'setScreenShare':
            void driver.current?.setScreenShare(e.on).catch(() => send({ type: 'SCREEN_SHARE', on: false }));
            break;
          case 'presence':
            if (token) void callApi.presence(token, bookingId, e.event).catch(() => undefined);
            if (e.event === 'left') void finish();
            break;
          case 'startHeartbeat':
            clearInterval(timers.current.hb);
            timers.current.hb = setInterval(async () => {
              const stats = (await driver.current?.sampleStats()) ?? {};
              send({ type: 'QUALITY', sample: stats });
              if (token) void callApi.presence(token, bookingId, 'heartbeat').catch(() => undefined);
            }, POLICY.heartbeatMs);
            break;
          case 'stopHeartbeat':
            clearInterval(timers.current.hb);
            clearTimeout(timers.current.rc);
            break;
          case 'reportQuality':
            if (token) void callApi.presence(token, bookingId, 'heartbeat', { tier: e.tier, reconnects: e.reconnects, joinMs: e.joinMs ?? undefined }).catch(() => undefined);
            break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookingId, token, finish],
  );

  const send = useCallback(
    (ev: CallEvent) => {
      const step = reduce(ctxRef.current, ev);
      ctxRef.current = step.ctx; // bir xil tick ichida ketma-ket hodisalar uchun
      dispatchRaw(ev);
      run(step.effects);
    },
    [run],
  );

  async function connect(isRetry: boolean) {
    if (!token) return;
    try {
      driver.current ??= createRtcDriver();
      if (!driver.current) return send({ type: 'FATAL', message: 'rtc_unavailable' });
      const tok = await callApi.token(token, bookingId);
      if (isRetry) await driver.current.disconnect().catch(() => undefined);
      await driver.current.connect(
        tok.url,
        tok.token,
        {
          onDisconnected: () => ctxRef.current.state === 'connected' && send({ type: 'CONNECTION_LOST', now: Date.now() }),
          onReconnecting: () => send({ type: 'CONNECTION_LOST', now: Date.now() }),
          onReconnected: () => send({ type: 'RECONNECTED', now: Date.now() }),
          onRemoteVideo: (t) => setRemoteVideo(t),
          onRemoteJoined: () => setRemoteJoined(true),
          onRemoteLeft: () => setRemoteJoined(false),
          onData: (text) => setChat((c) => [...c, { id: ++lineId.current, mine: false, text }]),
        },
        { videoEnabled: !ctxRef.current.cameraOff && !ctxRef.current.audioOnlyAuto },
      );
      send({ type: ctxRef.current.state === 'reconnecting' ? 'RECONNECTED' : 'CONNECTED', now: Date.now() });
    } catch (e) {
      // Token xatosi (oyna yopilgan va h.k.) darhol "failed"; tarmoq xatosi qayta urinishga qoldiriladi
      if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) send({ type: 'FATAL', message: e.code ?? String(e.statusCode) });
      else if (!isRetry) send({ type: 'CONNECTION_LOST', now: Date.now() });
    }
  }

  // Dars oynasi yopilganini kuzatish (server vaqti bo'yicha)
  useEffect(() => {
    if (!lobby) return;
    timers.current.win = setInterval(() => {
      const now = Date.now() + clockSkew.current;
      if (now > new Date(lobby.joinWindow.closesAt).getTime() && ['connected', 'reconnecting', 'connecting'].includes(ctxRef.current.state)) {
        send({ type: 'WINDOW_CLOSED' });
      }
    }, 10_000);
    return () => clearInterval(timers.current.win);
  }, [lobby, send]);

  useEffect(
    () => () => {
      clearInterval(timers.current.hb);
      clearTimeout(timers.current.rc);
      clearInterval(timers.current.win);
      void driver.current?.disconnect();
    },
    [],
  );

  return {
    availability,
    lobby,
    ctx,
    summary,
    error,
    remoteJoined,
    remoteVideo,
    chat,
    localVideo: () => driver.current?.localVideoTrack() ?? null,
    reload: loadLobby,
    enterLobby: () => send({ type: 'ENTER_LOBBY' }),
    join: () => send({ type: 'JOIN', now: Date.now() }),
    leave: () => send({ type: 'LEAVE' }),
    toggleMic: () => send({ type: 'TOGGLE_MIC' }),
    toggleCamera: () => send({ type: 'TOGGLE_CAMERA' }),
    flipCamera: () => void driver.current?.flipCamera(),
    toggleShare: () => send({ type: 'SCREEN_SHARE', on: !ctxRef.current.screenSharing }),
    sendChat: (text: string) => {
      const clean = text.trim().slice(0, 500);
      if (!clean) return;
      setChat((c) => [...c, { id: ++lineId.current, mine: true, text: clean }]);
      void driver.current?.sendChat(clean);
    },
  };
}
