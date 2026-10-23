import { revalidateTag } from 'next/cache';

import { readToken } from './client.js';
import type { KitfulNotification } from './types.js';

// The Standard Webhooks window: a notification older or newer than this is a replay.
const TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();
const PROFILES: Record<string, 'max' | { expire: number } | undefined> = {
  'post.published': { expire: 0 },
  'post.updated': 'max',
  'post.deleted': { expire: 0 }
};

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * The HMAC key for notifications. Kitful signs with the SHA-256 digest of the read token, so
 * the token alone verifies them; pass the `whsec_` secret instead to verify without it.
 */
async function signingKey(secret?: string): Promise<CryptoKey> {
  const raw = secret
    ? decodeBase64(secret.replace(/^whsec_/, ''))
    : new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(readToken())));
  if (!raw?.length) throw new Error('The Kitful notification secret is not valid base64.');
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
}

/** Checks a Standard Webhooks signature and its timestamp. */
export async function verifyNotification(
  body: string,
  headers: Headers,
  key: CryptoKey,
  now = Date.now()
): Promise<boolean> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures) return false;
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS)
    return false;
  const signed = encoder.encode(`${id}.${timestamp}.${body}`);
  for (const entry of signatures.split(' ')) {
    const [version, signature] = entry.split(',');
    if (version !== 'v1' || !signature) continue;
    const bytes = decodeBase64(signature);
    if (bytes && (await crypto.subtle.verify('HMAC', key, bytes, signed))) return true;
  }
  return false;
}

/**
 * The `POST` handler for `app/api/kitful/revalidate/route.ts`. It verifies Kitful's notification
 * and refreshes the cached pages it names. A publish or delete expires them at once, so the list
 * shows a new post and drops a deleted one on the next visit; an edit serves the old version while
 * the new one renders.
 */
export function createRevalidateHandler(options: { secret?: string } = {}) {
  let key: Promise<CryptoKey> | undefined;
  return async function POST(request: Request): Promise<Response> {
    key ??= signingKey(options.secret).catch((error: unknown) => {
      key = undefined;
      throw error;
    });
    // Awaited before the body, so a missing token fails here with its own message.
    const cryptoKey = await key;
    const body = await request.text();
    if (!(await verifyNotification(body, request.headers, cryptoKey))) {
      return Response.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    let notification: KitfulNotification;
    try {
      notification = JSON.parse(body) as KitfulNotification;
    } catch {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }
    // Event types Kitful adds later are acknowledged and ignored, as the API contract asks.
    const profile = Object.hasOwn(PROFILES, notification.type)
      ? PROFILES[notification.type]
      : undefined;
    if (!profile) return Response.json({ ok: true, revalidated: [] });
    const tags = (notification.data?.tags ?? []).filter(
      (tag): tag is string => typeof tag === 'string' && tag.startsWith('kitful:')
    );
    for (const tag of tags) revalidateTag(tag, profile);
    return Response.json({ ok: true, revalidated: tags });
  };
}
