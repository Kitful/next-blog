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

export const generateStaticParams = getStaticSlugs;

export async function generateMetadata({ params }: Props) {
  return getArticleMetadata((await params).slug);
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  if (post.slug !== slug) permanentRedirect(`/blog/${post.slug}`);

  return (
    <article>
      <h1>{post.title}</h1>
      <FeaturedImage post={post} preload />
      <ArticleBody post={post} />
      <ArticleJsonLd post={post} />
    </article>
  );
}
