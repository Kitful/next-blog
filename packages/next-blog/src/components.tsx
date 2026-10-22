import Image from 'next/image';

import type { KitfulPost, KitfulPostSummary } from './types.js';

const IMAGE_HOST = 'img.kitful.ai';

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** The article body. Style it with your own typography; it carries no classes of its own. */
export function ArticleBody({ post, className }: { post: KitfulPost; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: post.content.html }} />;
}

/** The post's structured data. `<` is escaped so no value can close the script tag. */
export function ArticleJsonLd({ post }: { post: KitfulPost }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(post.json_ld).replace(/</g, '\\u003c') }}
    />
  );
}

/**
 * The featured image through `next/image` when it is on img.kitful.ai and its size is known
 * (add img.kitful.ai to `images.remotePatterns`), otherwise a plain `<img>`.
 */
export function FeaturedImage({
  post,
  className,
  preload,
  sizes = '100vw'
}: {
  post: KitfulPostSummary;
  className?: string;
  preload?: boolean;
  sizes?: string;
}) {
  const image = post.featured_image;
  if (!image) return null;
  const { url, alt, width, height } = image;
  if (width && height && hostOf(url) === IMAGE_HOST) {
    return (
      <Image
        src={url}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        preload={preload}
        className={className}
      />
    );
  }
  return <img src={url} alt={alt} className={className} loading={preload ? 'eager' : 'lazy'} />;
}
