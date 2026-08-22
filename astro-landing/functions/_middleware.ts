/**
 * Cloudflare Pages Functions middleware — agent SEO surfaces for aliveville.com.
 * Handles /openapi.json, JSON error responses, Vary: Accept, and agent-friendly 404s.
 */

const SITE_ORIGIN = 'https://aliveville.com';

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
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        responses: {
          '200': { description: 'Agent catalog JSON', content: { 'application/json': {} } },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        responses: { '200': { description: 'Markdown index', content: { 'text/plain': {} } } },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        responses: { '200': { description: 'XML sitemap', content: { 'application/xml': {} } } },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          '200': { description: 'OpenAPI 3.1 spec', content: { 'application/json': {} } },
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

function jsonError(status: number, code: string, message: string, path: string): Response {
  return new Response(JSON.stringify({ error: { code, message, path } }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
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
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const origin = url.origin;

  // /openapi.json — serve the spec directly
  if (pathname === '/openapi.json') {
    return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  // JSON error for unknown /api/* paths (excluding /api/ai which is a static file)
  if (pathname.startsWith('/api/') && pathname !== '/api/ai') {
    return jsonError(404, 'not_found', `Unknown API path: ${pathname}`, pathname);
  }

  // Agent-friendly 404: markdown body for Accept: text/markdown on non-asset paths
  if (wantsMarkdown(request) && !pathname.includes('.') && pathname !== '/') {
    return markdown404(pathname, origin);
  }

  const response = await next();

  // Add Vary: Accept to HTML responses that have markdown alternates
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const headers = new Headers(response.headers);
    const vary = headers.get('vary');
    headers.set('vary', vary ? `${vary}, Accept, Accept-Encoding` : 'Accept, Accept-Encoding');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}
