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
  origin?: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...COMMON_HEADERS,
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

export function errorResponse(
  status: number,
  message: string,
  origin?: string,
): Response {
  return jsonResponse(status, { error: message }, origin);
}

export function getRequestOrigin(req: Request): string | null {
  return req.headers.get('origin');
}

export function handlePreflight(
  req: Request,
  allowedOrigins: readonly string[],
): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const origin = getRequestOrigin(req);
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function assertPost(req: Request): void {
  if (req.method !== 'POST') {
    throw new Error('Method Not Allowed');
  }
}

export function assertOrigin(req: Request, allowedOrigins: readonly string[]): string {
  const origin = getRequestOrigin(req);
  if (!origin) throw new Error('Missing Origin');
  if (!allowedOrigins.includes(origin)) throw new Error('Invalid Origin');
  return origin;
}

export function getCorsOriginIfAllowed(
  req: Request,
  allowedOrigins: readonly string[],
): string | undefined {
  const origin = getRequestOrigin(req);
  if (!origin) return undefined;
  return allowedOrigins.includes(origin) ? origin : undefined;
}
