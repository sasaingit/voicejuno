import { SignJWT } from 'npm:jose@5.9.6';
import type { Env } from './env.ts';

export type SupabaseJwtClaims = {
  sub: string;
  role: 'authenticated';
  aud: 'authenticated';
};

export async function mintSupabaseJwt(
  env: Env,
  claims: SupabaseJwtClaims,
  expiresInSeconds = 60 * 60 * 24,
): Promise<string> {
  const secretKey = new TextEncoder().encode(env.JWT_SECRET);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + expiresInSeconds)
    .sign(secretKey);
}
