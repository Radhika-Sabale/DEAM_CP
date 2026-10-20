export function getClientIp(request, trustProxy) {
  const socketIp = request.socket.remoteAddress ?? 'unknown';
  if (!trustProxy) return socketIp;

  // Render routes public requests through Cloudflare, which supplies this edge-set client IP.
  const cloudflareIp = request.headers['cf-connecting-ip'];
  if (typeof cloudflareIp === 'string' && cloudflareIp.trim()) return cloudflareIp.trim();

  // Render's X-Forwarded-For fallback keeps the client address at the left edge of the chain.
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return socketIp;
}
