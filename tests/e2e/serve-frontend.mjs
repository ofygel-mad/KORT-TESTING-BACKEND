import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const spaEntry = path.join(distDir, 'index.html');
const host = process.env.E2E_FRONTEND_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.E2E_FRONTEND_PORT || '4173', 10);
const backendTarget = new URL(process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function safeResolveAsset(pathname) {
  const relativePath = pathname.replace(/^\/+/, '');
  const candidate = path.resolve(distDir, relativePath);

  if (!candidate.startsWith(distDir)) {
    return null;
  }

  return candidate;
}

function hasFileExtension(pathname) {
  return path.extname(pathname) !== '';
}

function writeError(res, statusCode, message) {
  if (res.headersSent) {
    res.end();
    return;
  }

  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function proxyRequest(req, res) {
  const upstream = http.request(
    {
      protocol: backendTarget.protocol,
      hostname: backendTarget.hostname,
      port: backendTarget.port,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: backendTarget.host,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.on('error', () => {
        if (!res.writableEnded) {
          res.end();
        }
      });
      upstreamRes.pipe(res);
    },
  );

  proxyRequestCleanup(req, res, upstream);
  req.pipe(upstream);
}

function proxyRequestCleanup(req, res, upstream) {
  const destroyUpstream = () => {
    if (!upstream.destroyed) {
      upstream.destroy();
    }
  };

  req.on('aborted', destroyUpstream);
  req.on('error', destroyUpstream);
  res.on('close', destroyUpstream);

  upstream.on('error', (error) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    writeError(res, 502, 'Bad Gateway');
  });
}

async function serveFile(res, filePath, method) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes.get(extension) || 'application/octet-stream';
  const stat = await fs.promises.stat(filePath);

  res.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': contentType,
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  if (method === 'HEAD') {
    res.end();
    return;
  }

  pipeline(fs.createReadStream(filePath), res, () => {});
}

async function handleRequest(req, res) {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    proxyRequest(req, res);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    writeError(res, 405, 'Method Not Allowed');
    return;
  }

  const assetPath = safeResolveAsset(pathname);

  if (!assetPath) {
    writeError(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fs.promises.stat(assetPath);

    if (stat.isFile()) {
      await serveFile(res, assetPath, method);
      return;
    }

    const directoryIndex = path.join(assetPath, 'index.html');
    await serveFile(res, directoryIndex, method);
    return;
  } catch {
    if (hasFileExtension(pathname)) {
      writeError(res, 404, 'Not Found');
      return;
    }
  }

  await serveFile(res, spaEntry, method);
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res).catch(() => {
    writeError(res, 500, 'Internal Server Error');
  });
});

server.on('clientError', (error, socket) => {
  if (error.code !== 'ECONNRESET' && socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }

  socket.destroy();
});

server.listen(port, host, () => {
  process.stdout.write(`E2E frontend server listening on http://${host}:${port}\n`);
});
