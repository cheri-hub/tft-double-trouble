import { createClient } from 'npm:@supabase/supabase-js@2';

export const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'content-type': 'application/json',
};

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service environment is not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function participantCredential(): Promise<{ token: string; tokenHash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeBase64Url(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { token, tokenHash };
}

export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export function options(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response(null, { status: 204, headers }) : null;
}

export function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : 'internal_error';
  const known = ['room_not_found', 'room_expired', 'room_full', 'participant_not_found'];
  if (known.includes(code)) {
    const status = code === 'room_not_found' ? 404 : code === 'participant_not_found' ? 401 : 409;
    return json({ error: code }, status);
  }
  console.error(error);
  return json({ error: 'internal_error' }, 500);
}

export async function objectBody(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('invalid_body');
  }
  return value as Record<string, unknown>;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
