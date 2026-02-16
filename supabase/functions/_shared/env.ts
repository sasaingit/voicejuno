export type Env = {
  URL: string;
  SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
  // Optional comma-separated allowlist of origins (e.g. "http://localhost:5173,https://voicejuno.life")
  // If provided, it takes precedence over WEBAUTHN_ORIGIN for CORS/origin checks.
  WEBAUTHN_ORIGINS?: string;
  WEBAUTHN_RP_NAME: string;
};

function requiredEnv(name: keyof Env): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv(): Env {
  return {
    URL: requiredEnv('URL'),
    SERVICE_ROLE_KEY: requiredEnv('SERVICE_ROLE_KEY'),
    JWT_SECRET: requiredEnv('JWT_SECRET'),
    WEBAUTHN_RP_ID: requiredEnv('WEBAUTHN_RP_ID'),
    WEBAUTHN_ORIGIN: requiredEnv('WEBAUTHN_ORIGIN'),
    WEBAUTHN_ORIGINS: Deno.env.get('WEBAUTHN_ORIGINS') ?? undefined,
    WEBAUTHN_RP_NAME: requiredEnv('WEBAUTHN_RP_NAME'),
  };
}

export function getAllowedOrigins(env: Env): string[] {
  const raw = env.WEBAUTHN_ORIGINS;
  if (!raw) return [env.WEBAUTHN_ORIGIN];

  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return origins.length > 0 ? origins : [env.WEBAUTHN_ORIGIN];
}
