const COMMON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
} as const;

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...COMMON_HEADERS,
      ...corsHeaders(origin),
    },
  });
}

export function errorResponse(
  status: number,
  message: string,
  origin: string,
): Response {
  return jsonResponse(status, { error: message }, origin);
}

export function getRequestOrigin(req: Request): string | null {
  return req.headers.get('origin');
}

export function handlePreflight(req: Request, allowedOrigin: string): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const origin = getRequestOrigin(req);
  if (!origin || origin !== allowedOrigin) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowedOrigin),
  });
}

export function assertPost(req: Request): void {
  if (req.method !== 'POST') {
    throw new Error('Method Not Allowed');
  }
}

export function assertOrigin(req: Request, allowedOrigin: string): string {
  const origin = getRequestOrigin(req);
  if (!origin) throw new Error('Missing Origin');
  if (origin !== allowedOrigin) throw new Error('Invalid Origin');
  return origin;
}
