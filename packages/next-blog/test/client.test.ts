import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  blogSitemap,
  getAllPosts,
  getArticleMetadata,
  getPost,
  getStaticSlugs,
  KitfulError
} from '../src/client.js';
import type { KitfulPost } from '../src/types.js';

const post: KitfulPost = {
  id: 'a1',
  status: 'published',
  slug: 'hello',
  previous_slugs: [],
  url: 'https://example.com/blog/hello',
  locale: 'en-US',
  title: 'Hello',
  excerpt: 'First post.',
  tags: [],
  published_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-21T09:00:00Z',
  reading_time_minutes: 1,
  word_count: 120,
  featured_image: null,
  seo: { title: 'Hello', description: 'First post.', canonical_url: 'https://example.com/blog/hello' },
  open_graph: { title: 'Hello', description: null, image_url: null },
  headings: [],
  content: { html: '<p>Hi</p>', markdown: 'Hi' },
  json_ld: {}
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  process.env.KITFUL_READ_TOKEN = 'kit_read_example_secret';
  delete process.env.KITFUL_API_URL;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Answers the list with these posts and each post by its slug, like the API.
function serve(posts: KitfulPost[], detail: Record<string, Response> = {}) {
  fetchMock.mockImplementation(async (input) => {
    const slug = String(input).match(/\/blog\/posts\/([^?]+)$/)?.[1];
    if (!slug) return json({ data: posts, next_cursor: null });
    const found = posts.find((p) => p.slug === slug);
    return detail[slug] ?? (found ? json(found) : json({ code: 'not_found' }, 404));
  });
}

describe('client', () => {
  it('sends the token and caches each call under its tag', async () => {
    serve([post]);
    await getPost('hello');
    const [[listUrl, listInit], [postUrl, postInit]] = fetchMock.mock.calls as [
      [string, RequestInit],
      [string, RequestInit]
    ];
    expect(listUrl).toBe('https://kitful.ai/api/v1/blog/posts?limit=100');
    expect(listInit).toMatchObject({ next: { tags: ['kitful:posts'] } });
    expect(postUrl).toBe('https://kitful.ai/api/v1/blog/posts/hello');
    expect(postInit).toMatchObject({
      headers: { Authorization: 'Bearer kit_read_example_secret' },
      cache: 'force-cache',
      next: { revalidate: 86_400, tags: ['kitful:post:hello'] }
    });
  });

  it('never fetches a slug the list does not have, so no uncacheable 404 is made', async () => {
    serve([post]);
    expect(await getPost('nope')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('finds a renamed post by its previous slug', async () => {
    serve([{ ...post, previous_slugs: ['old-hello'] }]);
    expect((await getPost('old-hello'))?.slug).toBe('hello');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://kitful.ai/api/v1/blog/posts/hello');
  });

  it('follows KITFUL_API_URL', async () => {
    process.env.KITFUL_API_URL = 'http://localhost:3000/api/v1/';
    fetchMock.mockResolvedValueOnce(json({ data: [], next_cursor: null }));
    await getAllPosts();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:3000/api/v1/blog/posts?limit=100');
  });

  it('fails clearly without a token', async () => {
    delete process.env.KITFUL_READ_TOKEN;
    await expect(getPost('hello')).rejects.toThrow(/KITFUL_READ_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for a post deleted after the list was cached', async () => {
    serve([post], { hello: json({ code: 'gone' }, 410) });
    expect(await getPost('hello')).toBeNull();
  });

  it('surfaces the API error code', async () => {
    fetchMock.mockResolvedValue(
      json({ error: 'Bad token.', message: 'Bad token.', code: 'invalid_token' }, 401)
    );
    const error = await getPost('hello').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KitfulError);
    expect(error).toMatchObject({ status: 401, code: 'invalid_token' });
  });

  it('follows the cursor through every page', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: [post], next_cursor: 'c2' }))
      .mockResolvedValueOnce(json({ data: [{ ...post, id: 'a2', slug: 'two' }], next_cursor: null }));
    const posts = await getAllPosts();
    expect(posts.map((p) => p.slug)).toEqual(['hello', 'two']);
    expect(fetchMock.mock.calls[1]![0]).toContain('cursor=c2');
  });

  it('never returns an empty static params list', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], next_cursor: null }));
    expect(await getStaticSlugs()).toEqual([{ slug: '_no-posts-yet' }]);
  });

  it('builds metadata with the canonical and article dates', async () => {
    serve([post]);
    const metadata = await getArticleMetadata('hello');
    expect(metadata.alternates?.canonical).toBe('https://example.com/blog/hello');
    expect(metadata.openGraph).toMatchObject({ type: 'article', description: 'First post.' });
  });

  it('lists every post URL in the sitemap', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [post], next_cursor: null }));
    expect(await blogSitemap()).toEqual([
      { url: 'https://example.com/blog/hello', lastModified: '2026-10-21T09:00:00Z' }
    ]);
  });
});
