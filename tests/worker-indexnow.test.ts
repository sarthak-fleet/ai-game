import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { INDEXNOW_KEY, INDEXNOW_KEY_PATH, serveIndexNowKey } from '../worker/src/indexnow.ts';

describe('Worker IndexNow ownership route', () => {
  it('serves the public key at the path-scoped verification URL', async () => {
    const response = serveIndexNowKey(INDEXNOW_KEY_PATH);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response?.text()).toBe(INDEXNOW_KEY);
  });

  it('keeps the built static key in sync and ignores other paths', () => {
    const publicKey = readFileSync(
      new URL('../web3d/public/fa7259e2e0d942f1a1267b344a75a143.txt', import.meta.url),
      'utf8'
    );

    expect(publicKey.trim()).toBe(INDEXNOW_KEY);
    expect(serveIndexNowKey('/game/')).toBeNull();
  });
});
