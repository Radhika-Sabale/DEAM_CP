import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const publicAssetPaths = new Set([
  '/favicon.ico', '/favicon.svg', '/favicon-16.png', '/favicon-32.png',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/logo-mark.svg', '/logo-lockup.svg', '/site.webmanifest',
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

export function createStaticHandler(distDirectory) {
  const dist = resolve(distDirectory);

  return function serveStatic(request, response, url) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return response.end('Method not allowed.');
    }

    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return response.end('Invalid path.');
    }

    const requested = resolve(dist, `.${pathname}`);
    const safePath = requested === dist || requested.startsWith(`${dist}/`) || requested.startsWith(`${dist}\\`);
    const requestedFileExists = safePath && existsSync(requested) && statSync(requested).isFile();
    if (!requestedFileExists && (publicAssetPaths.has(pathname) || extname(pathname))) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return response.end('Not found.');
    }

    const filePath = requestedFileExists ? requested : resolve(dist, 'index.html');
    if (!existsSync(filePath)) {
      response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return response.end('Built frontend not found. Run npm run build first.');
    }

    const extension = extname(filePath).toLowerCase();
    response.writeHead(200, {
      'content-type': contentTypes[extension] ?? 'application/octet-stream',
      'content-length': statSync(filePath).size,
      'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    return createReadStream(filePath).pipe(response);
  };
}
