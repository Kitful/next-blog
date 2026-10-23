export interface KitfulImage {
  url: string;
  /** Null when Kitful could not read the size, or the image is hosted elsewhere. */
  width: number | null;
  height: number | null;
  alt: string;
}

export interface KitfulHeading {
  depth: number;
  /** Equals the `id` of the heading in `content.html`. */
  slug: string;
  text: string;
}

export interface KitfulPostSummary {
  /** Never changes; use it as the key when you store posts. */
  id: string;
  status: 'published';
  slug: string;
  /** Slugs this post was published under before. Empty until Kitful allows renaming a published post. */
  previous_slugs: string[];
  /** The post's address on your site. */
  url: string;
  locale: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  published_at: string;
  updated_at: string;
  reading_time_minutes: number;
  word_count: number;
  featured_image: KitfulImage | null;
  seo: { title: string; description: string | null; canonical_url: string };
  open_graph: { title: string; description: string | null; image_url: string | null };
}

export interface KitfulPost extends KitfulPostSummary {
  headings: KitfulHeading[];
  content: { html: string; markdown: string };
  json_ld: Record<string, unknown>;
}

export interface KitfulPage<T> {
  data: T[];
  next_cursor: string | null;
}

export interface KitfulNotification {
  type: 'post.published' | 'post.updated' | 'post.deleted' | 'webhook.test' | (string & {});
  timestamp: string;
  data: {
    post?: { id: string; slug: string; updated_at: string };
    paths: string[];
    tags: string[];
  };
}
