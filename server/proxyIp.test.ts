import { describe, expect, it } from 'vitest';
import { getClientIp } from './proxyIp.mjs';

const request = (headers: Record<string, string>, remoteAddress = '127.0.0.1') => ({ headers, socket: { remoteAddress } });

describe('Render proxy client IP resolution', () => {
  it('uses the socket address when proxy trust is disabled locally', () => {
    expect(getClientIp(request({ 'cf-connecting-ip': '198.51.100.10', 'x-forwarded-for': '198.51.100.11' }), false)).toBe('127.0.0.1');
  });

  it('uses Cloudflare client IP for production rate-limit identity', () => {
    expect(getClientIp(request({ 'cf-connecting-ip': '198.51.100.10', 'x-forwarded-for': 'spoofed, 198.51.100.10' }), true)).toBe('198.51.100.10');
  });

  it('uses the platform X-Forwarded-For client entry when the edge header is absent', () => {
    expect(getClientIp(request({ 'x-forwarded-for': '198.51.100.12, 10.0.0.1' }), true)).toBe('198.51.100.12');
  });

  it('falls back to the socket address when trusted proxy headers are missing', () => {
    expect(getClientIp(request({}), true)).toBe('127.0.0.1');
  });
});
