// Tiny front door so ONE tunnel serves both Metro (the app bundle) and the local backend:
//   https://<tunnel>/_api/...  -> backend (prefix removed)      everything else -> Metro (incl. websockets)
// Usage: node dev-proxy.js <listenPort> <metroPort> <apiPort>
const http = require('http');
const net = require('net');
const [listen, metro, api] = process.argv.slice(2).map(Number);

function target(url) {
  return url.startsWith('/_api/') || url === '/_api' ? { port: api, path: url.slice(5) || '/' } : { port: metro, path: url };
}

const server = http.createServer((req, res) => {
  const t = target(req.url);
  const up = http.request({ host: '127.0.0.1', port: t.port, path: t.path, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end('upstream not ready');
  });
  req.pipe(up);
});

server.on('upgrade', (req, socket, head) => {
  const t = target(req.url);
  const up = net.connect(t.port, '127.0.0.1', () => {
    up.write(`${req.method} ${t.path} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (head && head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(listen, '127.0.0.1', () => console.log(`dev proxy on ${listen} (metro ${metro}, api ${api})`));
