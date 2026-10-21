import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticHandler } from './staticFiles.mjs';

const publicDirectory = join(process.cwd(), 'public');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'deam-static-test-'));
const noAssetDirectory = temporaryDirectory;
async function requestStatic(directory: string, url: string) {
  const response = new PassThrough() as PassThrough & {
    statusCode?: number;
    headersSent?: Record<string, string | number>;
    writeHead: (status: number, headers: Record<string, string | number>) => PassThrough;
  };
  response.writeHead = (status, headers) => {
    response.statusCode = status;
    response.headersSent = headers;
    return response;
  };
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  const ended = new Promise<void>((resolveEnd, reject) => {
    response.on('end', resolveEnd);
    response.on('error', reject);
  });
  createStaticHandler(directory)({ method: 'GET' }, response, new URL(url, 'http://localhost'));
  await ended;
  return {
    status: response.statusCode,
    headers: response.headersSent ?? {},
    body: Buffer.concat(chunks).toString('utf8'),
  };
}

beforeAll(async () => {
  writeFileSync(join(noAssetDirectory, 'index.html'), '<!doctype html><title>SPA fixture</title>');
});

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe('production static asset serving', () => {
  it.each([
    ['/favicon.ico', 'image/x-icon'],
    ['/favicon.svg', 'image/svg+xml'],
    ['/favicon-16.png', 'image/png'],
    ['/favicon-32.png', 'image/png'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/icon-192.png', 'image/png'],
    ['/icon-512.png', 'image/png'],
    ['/logo-mark.svg', 'image/svg+xml'],
    ['/logo-lockup.svg', 'image/svg+xml'],
    ['/site.webmanifest', 'application/manifest+json; charset=utf-8'],
  ])('serves %s with its file content type and a one-day cache', async (path, contentType) => {
    const response = await requestStatic(publicDirectory, path);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(contentType);
    expect(response.headers['cache-control']).toBe('public, max-age=86400');
    expect(response.body).not.toContain('<!doctype html>');
  });

  it('does not send the SPA document for a missing asset, but keeps SPA route fallback', async () => {
    const missingAsset = await requestStatic(noAssetDirectory, '/logo-mark.svg');
    expect(missingAsset.status).toBe(404);
    expect(missingAsset.body).toBe('Not found.');

    const appRoute = await requestStatic(noAssetDirectory, '/projects/example');
    expect(appRoute.status).toBe(200);
    expect(appRoute.body).toContain('SPA fixture');
  });
});
