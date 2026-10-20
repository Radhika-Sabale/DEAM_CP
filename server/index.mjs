import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuizGenerator } from './quiz.mjs';
import { getClientIp } from './proxyIp.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');
try {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* Optional local environment file. */ }

const generateQuiz = createQuizGenerator();
const limits = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const trustProxy = process.env.NODE_ENV === 'production';

async function verifiedUser(request) {
  const authorization = request.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;
  return response.json();
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function serveStatic(request, response, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error: 'Method not allowed.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(response, 400, { error: 'Invalid path.' }); }
  const requested = resolve(dist, `.${pathname}`);
  const safePath = requested === dist || requested.startsWith(`${dist}/`) || requested.startsWith(`${dist}\\`);
  const filePath = safePath && existsSync(requested) && statSync(requested).isFile() ? requested : resolve(dist, 'index.html');
  if (!existsSync(filePath)) return send(response, 503, { error: 'Built frontend not found. Run npm run build first.' });
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  };
  const isHtml = extension === '.html';
  response.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream',
    'content-length': statSync(filePath).size,
    'cache-control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/health' && request.method === 'GET') return send(response, 200, { ok: true });
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/teacher' && request.method === 'GET') {
      if (!supabaseUrl || !supabaseAnonKey) return send(response, 503, { error: 'Login not configured.' });
      try {
        const user = await verifiedUser(request);
        if (!user) return send(response, 401, { error: 'Sign in to continue.' });
        if (user.app_metadata?.role !== 'teacher') return send(response, 403, { error: 'Teacher access required.' });
        return send(response, 200, { authorized: true });
      } catch { return send(response, 502, { error: 'Could not verify teacher access.' }); }
    }
    if (request.method !== 'POST' || url.pathname !== '/api/quiz/generate') return send(response, 404, { error: 'Not found.' });
  } else {
    if (process.env.NODE_ENV === 'production') return serveStatic(request, response, url);
    return send(response, 404, { error: 'Not found.' });
  }
  const ip = getClientIp(request, trustProxy);
  const now = Date.now();
  const limit = limits.get(ip);
  if (limit && limit.expiresAt > now && limit.count >= MAX_REQUESTS) return send(response, 429, { error: 'Too many quiz requests. Wait a minute and try again.' });
  limits.set(ip, !limit || limit.expiresAt <= now ? { count: 1, expiresAt: now + WINDOW_MS } : { ...limit, count: limit.count + 1 });

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const user = await verifiedUser(request);
      if (!user) return send(response, 401, { error: 'Sign in to generate a quiz.' });
    } catch { return send(response, 502, { error: 'Could not verify your sign-in. Try again.' }); }
  } else if (process.env.GEMINI_API_KEY) {
    return send(response, 503, { code: 'AUTH_NOT_CONFIGURED', error: 'Login is not configured. Sign-in is required for AI quiz generation.' });
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8_192) return send(response, 413, { error: 'Request is too large.' });
  }
  let input;
  try { input = JSON.parse(raw); } catch { return send(response, 400, { error: 'Send a valid JSON request.' }); }
  try {
    const result = await generateQuiz({ topicId: input.topicId, difficulty: input.difficulty, questionCount: input.questionCount });
    return send(response, result.status, result.body);
  } catch {
    return send(response, 502, { error: 'Quiz generation failed. The static quiz is still available.' });
  }
}).listen(Number(process.env.PORT) || 3001, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
  process.stdout.write(`App server listening on ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'}:${Number(process.env.PORT) || 3001}\n`);
});
