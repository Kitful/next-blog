import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@kitful/next-blog';

export const metadata: Metadata = { title: 'Blog' };

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <main>
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
            <time dateTime={post.published_at}>{post.published_at.slice(0, 10)}</time>
          </li>
        ))}
      </ul>
    </main>
  );
}
