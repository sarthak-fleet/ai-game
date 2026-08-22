/**
 * Cloudflare Pages Functions middleware — agent SEO surfaces for aliveville.com.
 * Handles /openapi.json, JSON error responses, Accept: text/markdown negotiation
 * for pages with .md alternates, Vary: Accept, rate-limit headers, and
 * agent-friendly 404s with markdown recovery body.
 */

interface Env {
  ASSETS: Fetcher;
}

const SITE_ORIGIN = 'https://aliveville.com';

const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW = 60;

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Machine-readable error code' },
        message: { type: 'string', description: 'Human-readable error message' },
        path: { type: 'string', description: 'The request path that caused the error' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
};

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Aliveville public API',
    version: '1.0.0',
    description:
      'Browser-playable 3D AI world simulator. The public web API exposes read-only agent surfaces.',
    contact: { name: 'Aliveville', url: SITE_ORIGIN },
  },
  servers: [{ url: SITE_ORIGIN }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  components: {
    schemas: {
      AgentCatalog: {
        type: 'object',
        description: 'JSON inventory of public agent surfaces and per-page markdown alternates.',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          llms: { type: 'string', format: 'uri' },
          sitemap: { type: 'string', format: 'uri' },
          openapi: { type: 'string', format: 'uri' },
          markdown: {
            type: 'object',
            properties: {
              suffix: { type: 'string' },
              negotiation: { type: 'boolean' },
            },
          },
          surfaces: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                md: { type: 'string', format: 'uri' },
                kind: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
      ErrorResponse: ERROR_RESPONSE_SCHEMA,
    },
  },
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description:
          'JSON inventory of public agent surfaces: llms.txt, sitemap, robots, and per-page markdown alternates.',
        responses: {
          '200': {
            description: 'Agent catalog JSON',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AgentCatalog' } },
            },
          },
          '404': {
            description: 'Unknown API path',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        description: 'Compact agent index following the llms.txt convention.',
        responses: {
          '200': {
            description: 'Markdown index',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        description: 'XML sitemap of all canonical public HTML pages.',
        responses: {
          '200': {
            description: 'XML sitemap',
            content: { 'application/xml': { schema: { type: 'string' } } },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          '200': {
            description: 'OpenAPI 3.1 spec',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
  },
};

function wantsMarkdown(request: Request): boolean {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function markdownPathFor(pathname: string): string {
  const path = normalizePath(pathname);
  return path === '/' ? '/index.md' : `${path}.md`;
}

function withRateLimit(headers: Headers): Headers {
  headers.set('ratelimit-limit', String(RATE_LIMIT));
  headers.set('ratelimit-remaining', String(RATE_LIMIT));
  headers.set('ratelimit-reset', String(RATE_LIMIT_WINDOW));
  return headers;
}

function jsonError(status: number, code: string, message: string, path: string): Response {
  const headers = withRateLimit(
    new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    })
  );
  return new Response(JSON.stringify({ error: { code, message, path } }), { status, headers });
}

function markdown404(pathname: string, origin: string): Response {
  const body = `# 404 — Not Found

\`${pathname}\` does not exist on ${origin}.

## Where to look next

- [Home](${origin}/)
- [Sitemap](${origin}/sitemap.xml)
- [Agent index](${origin}/llms.txt)
- [Agent catalog (JSON)](${origin}/api/ai)
- [OpenAPI spec](${origin}/openapi.json)
`;
  const headers = withRateLimit(
    new Headers({
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
  );
  return new Response(body, { status: 404, headers });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const origin = url.origin;

  // /openapi.json — serve the spec directly
  if (pathname === '/openapi.json') {
    const headers = withRateLimit(
      new Headers({
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      })
    );
    return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), { headers });
  }

  // JSON error for unknown /api/* paths (excluding /api/ai which is a static file)
  if (pathname.startsWith('/api/') && pathname !== '/api/ai') {
    return jsonError(404, 'not_found', `Unknown API path: ${pathname}`, pathname);
  }

  // Accept: text/markdown negotiation for HTML pages that have a .md alternate.
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.endsWith('.md') &&
    !pathname.includes('.') &&
    !pathname.startsWith('/api/') &&
    wantsMarkdown(request)
  ) {
    const mdPath = markdownPathFor(pathname);
    const mdUrl = new URL(mdPath, url);
    const mdReq = new Request(mdUrl.toString(), request);
    const mdResp = await env.ASSETS.fetch(mdReq);
    if (mdResp.status === 200) {
      const headers = withRateLimit(new Headers(mdResp.headers));
      headers.set('content-type', 'text/markdown; charset=utf-8');
      headers.set('vary', 'Accept, Accept-Encoding');
      headers.set('x-content-type-options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : mdResp.body, {
        status: 200,
        headers,
      });
    }
  }

  // Pass through to static assets first — only intercept 404s after.
  const response = await next();

  // Agent-friendly 404: markdown body for Accept: text/markdown on non-asset, non-API paths.
  if (response.status === 404 && !pathname.startsWith('/api/') && !pathname.includes('.')) {
    if (wantsMarkdown(request)) {
      return markdown404(pathname, origin);
    }
    const headers = withRateLimit(new Headers(response.headers));
    headers.set('vary', 'Accept, Accept-Encoding');
    return new Response(response.body, { status: 404, headers });
  }

  // Add Vary: Accept to HTML responses that have markdown alternates
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const headers = withRateLimit(new Headers(response.headers));
    const vary = headers.get('vary');
    headers.set('vary', vary ? `${vary}, Accept, Accept-Encoding` : 'Accept, Accept-Encoding');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Add rate-limit headers to all other responses.
  const headers = withRateLimit(new Headers(response.headers));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
