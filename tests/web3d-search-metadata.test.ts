import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gameHtml = readFileSync(new URL('../web3d/index.html', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../web3d/public/sitemap.xml', import.meta.url), 'utf8');
const indexNowKey = readFileSync(
  new URL('../web3d/public/fa7259e2e0d942f1a1267b344a75a143.txt', import.meta.url),
  'utf8'
);

describe('Aliveville game search identity', () => {
  it('exposes one canonical, indexable game identity before JavaScript runs', () => {
    expect(gameHtml).toContain('<title>Aliveville — Play the AI World Simulator</title>');
    expect(gameHtml).toContain('<link rel="canonical" href="https://aliveville.com/game/" />');
    expect(gameHtml).toContain('<meta name="robots" content="index, follow');
    expect(gameHtml).toContain('"@type": "VideoGame"');
    expect(gameHtml).toContain('<h1>Aliveville AI World Simulator</h1>');
  });

  it('publishes the canonical playable route in its owned sitemap', () => {
    expect(sitemap).toContain('<loc>https://aliveville.com/game/</loc>');
    expect(gameHtml).toContain('href="https://aliveville.com/game/sitemap.xml"');
  });

  it('publishes the path-scoped IndexNow ownership key', () => {
    expect(indexNowKey.trim()).toBe('fa7259e2e0d942f1a1267b344a75a143');
  });

  it('publishes an agent-readable catalog with a Markdown mirror per route', () => {
    const catalog = JSON.parse(readFileSync('astro-landing/public/api-ai.json', 'utf8')) as {
      llmsFull?: string;
      surfaces?: Array<{ id: string; url: string; md: string; kind: string }>;
    };

    expect(catalog.llmsFull).toBe('https://aliveville.com/llms-full.txt');
    expect(catalog.surfaces?.map(({ id }) => id)).toEqual(['home', 'ai-world-simulator', 'game', 'privacy', 'terms']);

    for (const surface of catalog.surfaces ?? []) {
      const pathname = new URL(surface.md).pathname;
      const relativePath = pathname.startsWith('/game/')
        ? `web3d/public/${pathname.slice('/game/'.length)}`
        : `astro-landing/public/${pathname.slice(1)}`;
      expect(readFileSync(relativePath, 'utf8')).toMatch(/^#\s+\S/m);
    }
  });

  it('rewrites the extensionless agent catalog before static fallback', () => {
    const redirects = readFileSync('astro-landing/public/_redirects', 'utf8');
    expect(redirects).toContain('/api/ai /api-ai.json 200');
  });
});
