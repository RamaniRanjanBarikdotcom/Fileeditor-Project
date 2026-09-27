import { verifyToken } from '../auth/jwt.js';

/**
 * Minimal WebSocket hub. Clients connect to /ws?token=<jwt> and receive
 * server-pushed events (generation progress, notifications, auth-expired).
 * Messages are JSON: { event: string, payload: any }.
 */
const userSockets = new Map(); // userId -> Set<socket>

// @fastify/websocket changed its handler signature across majors: older versions pass
// a SocketStream whose `.socket` is the ws WebSocket; v11+ passes the WebSocket directly.
// Normalize so this works regardless of the installed version.
function resolveSocket(connection) {
  return connection && connection.socket ? connection.socket : connection;
}

export function registerWebsocket(app) {
  app.get('/ws', { websocket: true }, (connection, req) => {
    const socket = resolveSocket(connection);
    const token = req.query?.token || '';
    const payload = token ? verifyToken(token) : null;
    if (!payload?.uid) {
      try {
        socket.close(1008, 'unauthorized');
      } catch {
        /* ignore */
      }
      return;
    }
    const userId = String(payload.uid);
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket);

    socket.on('close', () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) userSockets.delete(userId);
      }
    });
    socket.on('error', () => {
      userSockets.get(userId)?.delete(socket);
    });
  });
}

/** Push an event to all of a user's connected sockets. */
export function emitToUser(userId, event, payload) {
  const sockets = userSockets.get(String(userId));
  if (!sockets) return;
  const msg = JSON.stringify({ event, payload });
  for (const s of sockets) {
    try {
      s.send(msg);
    } catch {
      /* ignore broken socket */
    }
  }
}
