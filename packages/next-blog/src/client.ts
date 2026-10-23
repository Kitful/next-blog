import type { Metadata, MetadataRoute } from 'next';
import { notFound } from 'next/navigation';

import type { KitfulPage, KitfulPost, KitfulPostSummary } from './types.js';

const DEFAULT_API_URL = 'https://kitful.ai/api/v1';
// A notification refreshes a page within seconds; this only bounds one that never arrived.
const REVALIDATE_SECONDS = 86_400;
const PAGE_SIZE = 100;
// Under Cache Components an empty `generateStaticParams` fails `next build`, so a site with no
// posts yet gets this one slug, which renders the not-found page.
const NO_POSTS_SLUG = '_no-posts-yet';

/** Cache tag on every page of the post list. */
export const POSTS_TAG = 'kitful:posts';
/** Cache tag on one post. */
export const postTag = (slug: string) => `kitful:post:${slug}`;

export class KitfulError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'KitfulError';
  }
}

export function readToken(): string {
  const token = process.env.KITFUL_READ_TOKEN;
  if (!token) {
    throw new KitfulError(
      'KITFUL_READ_TOKEN is not set. Copy the read token from your headless destination in Kitful into your environment.'
    );
  }
  return token;
}

async function request<T>(path: string, tags: string[]): Promise<T | null> {
  const apiUrl = (process.env.KITFUL_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  const init: RequestInit & { next: { revalidate: number; tags: string[] } } = {
    headers: { Authorization: `Bearer ${readToken()}` },
    cache: 'force-cache',
    next: { revalidate: REVALIDATE_SECONDS, tags }
  };
  const response = await fetch(`${apiUrl}${path}`, init);
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    throw new KitfulError(
      body?.message ?? `Kitful answered ${response.status}.`,
      response.status,
      body?.code
    );
  }
  return (await response.json()) as T;
}

/** One page of published posts, newest first. */
export async function getPosts(
  options: { cursor?: string; limit?: number } = {}
): Promise<KitfulPage<KitfulPostSummary>> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.size ? `?${params}` : '';
  const page = await request<KitfulPage<KitfulPostSummary>>(`/blog/posts${query}`, [POSTS_TAG]);
  if (!page) throw new KitfulError('Kitful could not list posts.', 404);
  return page;
}

/** Every published post, newest first, without bodies. */
export async function getAllPosts(): Promise<KitfulPostSummary[]> {
  const posts: KitfulPostSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await getPosts({ limit: PAGE_SIZE, cursor });
    posts.push(...page.data);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return posts;
}

/**
 * One post with its body, or null when no post has this slug. Fetched by slug rather than found in
 * the cached list: the first render of a post published after the build can read the list as the
 * build cached it, and would serve the new post as not found.
 */
export async function getPost(slug: string): Promise<KitfulPost | null> {
  return request<KitfulPost>(`/blog/posts/${encodeURIComponent(slug)}`, [postTag(slug)]);
}

/** For `generateStaticParams` in `app/blog/[slug]/page.tsx`. */
export async function getStaticSlugs(): Promise<{ slug: string }[]> {
  const posts = await getAllPosts();
  return posts.length ? posts.map((post) => ({ slug: post.slug })) : [{ slug: NO_POSTS_SLUG }];
}

/**
 * For `generateMetadata` in `app/blog/[slug]/page.tsx`. A missing post calls `notFound()` here, so
 * crawlers that get the page without streaming receive a 404.
 */
export async function getArticleMetadata(slug: string): Promise<Metadata> {
  const post = await getPost(slug);
  if (!post) notFound();
  const image = post.open_graph.image_url ?? post.featured_image?.url;
  const images = image ? [image] : undefined;
  const description = post.seo.description ?? undefined;
  return {
    title: post.seo.title,
    description,
    alternates: { canonical: post.seo.canonical_url },
    openGraph: {
      type: 'article',
      url: post.url,
      title: post.open_graph.title,
      description: post.open_graph.description ?? description,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      tags: post.tags,
      images
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.open_graph.title,
      description: post.open_graph.description ?? description,
      images
    }
  };
}

// A canonical typed by hand still names the post when only the scheme or a trailing slash differs.
function samePage(canonical: string, url: string): boolean {
  try {
    const [a, b] = [new URL(canonical, url), new URL(url)];
    const path = (u: URL) => u.pathname.replace(/\/$/, '');
    return a.host === b.host && path(a) === path(b) && a.search === b.search;
  } catch {
    return false;
  }
}

/** For `app/blog/sitemap.ts`. */
export async function blogSitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  // A post whose canonical is another page belongs in that page's sitemap.
  return posts
    .filter((post) => samePage(post.seo.canonical_url, post.url))
    .map((post) => ({ url: post.url, lastModified: post.updated_at }));
}
