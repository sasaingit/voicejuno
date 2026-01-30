import { decodeBase64Url, encodeBase64Url } from 'https://deno.land/std@0.224.0/encoding/base64url.ts';

export function bytesToBase64Url(bytes: Uint8Array): string {
  return encodeBase64Url(bytes);
}

export function base64UrlToBytes(value: string): Uint8Array {
  return decodeBase64Url(value);
}

/**
 * Ensure a base64url string is in the canonical form commonly used by WebAuthn:
 * - URL-safe alphabet (- and _)
 * - no padding
 */
export function normalizeBase64Url(value: string): string {
  return value.trim().replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
