import { EDGE_FUNCTIONS_BASE_URL } from '../config';

export type Result<T> = { data: T; error: null } | { data: null; error: Error };

export type StartResponse<TOptions> = {
  options: TOptions;
  challengeId: string;
};

export type FinishResponse = {
  access_token?: string;
  refresh_token?: string;
};

const AUTH_HEADERS = Object.freeze({ 'Content-Type': 'application/json' });

const ROUTES = Object.freeze({
  registerStart: `${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-register-start`,
  registerFinish: `${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-register-finish`,
  loginStart: `${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-login-start`,
  loginFinish: `${EDGE_FUNCTIONS_BASE_URL}/auth-webauthn-login-finish`,
});

async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      return { data: null, error: new Error('Network error — please try again.') };
    }

    const json: unknown = await res.json();
    return { data: json as T, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error — please try again.';
    return { data: null, error: new Error(message) };
  }
}

export async function startWebauthnRegister(): Promise<
  Result<StartResponse<PublicKeyCredentialCreationOptions>>
> {
  return fetchJson<StartResponse<PublicKeyCredentialCreationOptions>>(ROUTES.registerStart, {
    method: 'POST',
    headers: AUTH_HEADERS,
  });
}

export async function finishWebauthnRegister(input: {
  credential: unknown;
  challengeId: string;
}): Promise<Result<FinishResponse>> {
  return fetchJson<FinishResponse>(ROUTES.registerFinish, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(input),
  });
}

export async function startWebauthnLogin(): Promise<
  Result<StartResponse<PublicKeyCredentialRequestOptions>>
> {
  return fetchJson<StartResponse<PublicKeyCredentialRequestOptions>>(ROUTES.loginStart, {
    method: 'POST',
    headers: AUTH_HEADERS,
  });
}

export async function finishWebauthnLogin(input: {
  credential: unknown;
  challengeId: string;
}): Promise<Result<FinishResponse>> {
  return fetchJson<FinishResponse>(ROUTES.loginFinish, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(input),
  });
}

export function getTokensOrError(response: FinishResponse): Result<{
  access_token: string;
  refresh_token: string;
}> {
  const access_token = response.access_token;
  const refresh_token = response.refresh_token;

  if (typeof access_token !== 'string' || typeof refresh_token !== 'string') {
    return {
      data: null,
      error: new Error('Session tokens were not returned.'),
    };
  }

  return { data: { access_token, refresh_token }, error: null };
}
