export type Env = {
  URL: string;
  SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
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
    WEBAUTHN_RP_NAME: requiredEnv('WEBAUTHN_RP_NAME'),
  };
}
