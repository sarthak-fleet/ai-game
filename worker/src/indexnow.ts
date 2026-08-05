export const INDEXNOW_KEY = 'fa7259e2e0d942f1a1267b344a75a143';
export const INDEXNOW_KEY_PATH = `/game/${INDEXNOW_KEY}.txt`;

export function serveIndexNowKey(pathname: string): Response | null {
  if (pathname !== INDEXNOW_KEY_PATH) return null;

  return new Response(INDEXNOW_KEY, {
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
