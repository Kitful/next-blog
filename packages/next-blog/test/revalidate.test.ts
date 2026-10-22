import { createHash } from 'node:crypto';

import { Webhook } from 'standardwebhooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const { createRevalidateHandler, verifyNotification } = await import('../src/revalidate.js');

const TOKEN = 'kit_read_example_0123456789abcdef';
// What Kitful shows as the notification secret: the read token's SHA-256 digest in base64.
const SECRET = `whsec_${createHash('sha256').update(TOKEN).digest('base64')}`;

function signedRequest(payload: unknown, secret = SECRET, timestamp = new Date()) {
  const body = JSON.stringify(payload);
  const id = 'msg_test';
  const signature = new Webhook(secret).sign(id, timestamp, body);
  return new Request('https://example.com/api/kitful/revalidate', {
    method: 'POST',
    body,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature
    }
  });
}

const updated = {
  type: 'post.updated',
  timestamp: '2026-10-22T09:02:11Z',
  data: {
    post: { id: 'a1', slug: 'hello', updated_at: '2026-10-22T09:02:11Z' },
    paths: ['/blog', '/blog/hello'],
    tags: ['kitful:posts', 'kitful:post:hello']
  }
};

beforeEach(() => {
  process.env.KITFUL_READ_TOKEN = TOKEN;
  revalidateTag.mockClear();
});
afterEach(() => {
  delete process.env.KITFUL_READ_TOKEN;
});

describe('verifyNotification', () => {
  it('accepts the Standard Webhooks specification example', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'), (c) => c.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const headers = new Headers({
      'webhook-id': 'msg_p5jXN8AQM9LWM0D4loKWxJek',
      'webhook-timestamp': '1614265330',
      'webhook-signature': 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='
    });
    const body = '{"test": 2432232314}';
    expect(await verifyNotification(body, headers, key, 1614265330_000)).toBe(true);
    expect(await verifyNotification(`${body} `, headers, key, 1614265330_000)).toBe(false);
    expect(await verifyNotification(body, headers, key, (1614265330 + 301) * 1000)).toBe(false);
  });
});

describe('createRevalidateHandler', () => {
  it('refreshes the listed tags when the token-derived signature matches', async () => {
    const response = await createRevalidateHandler()(signedRequest(updated));
    expect(response.status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ['kitful:posts', 'max'],
      ['kitful:post:hello', 'max']
    ]);
  });

  it.each(['post.published', 'post.deleted'])('expires the pages at once on %s', async (type) => {
    await createRevalidateHandler()(signedRequest({ ...updated, type }));
    expect(revalidateTag.mock.calls).toEqual([
      ['kitful:posts', { expire: 0 }],
      ['kitful:post:hello', { expire: 0 }]
    ]);
  });

  it('accepts an explicit whsec_ secret', async () => {
    delete process.env.KITFUL_READ_TOKEN;
    const response = await createRevalidateHandler({ secret: SECRET })(signedRequest(updated));
    expect(response.status).toBe(200);
  });

  it('rejects a wrong signature and touches no cache', async () => {
    const other = `whsec_${createHash('sha256').update('another token').digest('base64')}`;
    const response = await createRevalidateHandler()(signedRequest(updated, other));
    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects a replay older than five minutes', async () => {
    const old = new Date(Date.now() - 6 * 60 * 1000);
    const response = await createRevalidateHandler()(signedRequest(updated, SECRET, old));
    expect(response.status).toBe(401);
  });

  it('answers the test event without refreshing anything', async () => {
    const response = await createRevalidateHandler()(
      signedRequest({ type: 'webhook.test', timestamp: '', data: { paths: [], tags: [] } })
    );
    expect(response.status).toBe(200);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('ignores tags outside the kitful namespace', async () => {
    await createRevalidateHandler()(
      signedRequest({ ...updated, data: { ...updated.data, tags: ['kitful:posts', 'layout'] } })
    );
    expect(revalidateTag.mock.calls).toEqual([['kitful:posts', 'max']]);
  });
});
