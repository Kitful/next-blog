import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  ArticleBody,
  ArticleJsonLd,
  FeaturedImage,
  getArticleMetadata,
  getPost,
  getStaticSlugs
} from '@kitful/next-blog';

type Props = { params: Promise<{ slug: string }> };

// Next.js passes the slug percent-encoded; Kitful's slugs can hold any character.
const slugOf = async ({ params }: Props) => decodeURIComponent((await params).slug);

export const generateStaticParams = getStaticSlugs;

export async function generateMetadata(props: Props) {
  return getArticleMetadata(await slugOf(props));
}

// The slug is read inside Suspense, so the route's shared shell holds no one post, and a post
// published after the build never inherits the not-found page's metadata.
export default function PostPage(props: Props) {
  return (
    <Suspense>
      <Post {...props} />
    </Suspense>
  );
}

async function Post(props: Props) {
  const slug = await slugOf(props);
  const post = await getPost(slug);
  if (!post) notFound();
  if (post.slug !== slug) permanentRedirect(`/blog/${encodeURIComponent(post.slug)}`);

  return (
    <article>
      <h1>{post.title}</h1>
      <FeaturedImage post={post} preload />
      <ArticleBody post={post} />
      <ArticleJsonLd post={post} />
    </article>
  );
}
