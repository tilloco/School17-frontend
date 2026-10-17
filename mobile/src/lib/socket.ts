import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/** One live connection to the server's default namespace (the server only pushes events; sending goes through normal requests). */
export function openSocket(token: string): Socket {
  return io(API_URL, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 4000, timeout: 6000 });
}
