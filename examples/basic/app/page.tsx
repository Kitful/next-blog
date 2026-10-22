import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>Example site</h1>
      <Link href="/blog">Read the blog</Link>
    </main>
  );
}
