# @kitful/next-blog

Show the articles you publish from [Kitful](https://kitful.ai) on your Next.js site. Posts are cached like static pages and refresh seconds after you publish, update or delete one in Kitful.

- Next.js 16.3 or later, App Router, with Cache Components on or off
- Server-only: the read token never reaches the browser
- SEO included: metadata, canonical URL, Open Graph, JSON-LD and a blog sitemap
- No styles of its own: posts take your site's typography

## Setup

1. In Kitful, open **Integrations** and add **Headless**:
   - **Blog URL**: your site's address followed by `/blog`, such as `https://example.com/blog`. Each post's address, canonical link and sitemap entry are built from it.
   - **Notification URL**: your site's address followed by `/api/kitful/revalidate`.

   Copy the read token. Kitful shows it once.

2. Add the package and the four route files. In an app with a `components.json` (shadcn/ui), one command does both:

   ```bash
   npx shadcn@latest add Kitful/next-blog/blog
   ```

   Otherwise install the package and copy the [route files](#route-files) into your `app` folder, keeping their paths:

   ```bash
   npm install @kitful/next-blog
   ```

3. Set the token in `.env.local` and at your host. The build needs it too.

   ```bash
   KITFUL_READ_TOKEN=kit_read_...
   ```

4. Allow Kitful's image host in `next.config.ts`:

   ```ts
   const nextConfig = {
     images: { remotePatterns: [new URL('https://img.kitful.ai/**')] }
   };
   export default nextConfig;
   ```

5. Deploy, then press **Send test** on the destination in Kitful. Publish an article and open `/blog`.

## Route files

| File | Serves |
| --- | --- |
| [`app/blog/page.tsx`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/page.tsx) | `/blog`, every post newest first |
| [`app/blog/[slug]/page.tsx`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/%5Bslug%5D/page.tsx) | Each post with its metadata and JSON-LD |
| [`app/blog/sitemap.ts`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/sitemap.ts) | `/blog/sitemap.xml`; add it to your `robots.ts` |
| [`app/api/kitful/revalidate/route.ts`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/api/kitful/revalidate/route.ts) | Kitful's notifications |

The files are yours to style and wrap in your layout; the logic stays in the package, so `npm update` brings fixes. With `src/app`, put them there.

## How it works

Each read is a server-side `fetch` cached under a tag: `kitful:posts` for the list, `kitful:post:<slug>` for a post. When something changes, Kitful sends a signed [Standard Webhooks](https://www.standardwebhooks.com/) notification, and the route refreshes the tags it names:

- **Published or deleted**: the pages expire at once, so the next visit sees the change.
- **Updated**: the next visit gets the previous version while the new one renders; visits after that get the new one.

Without a notification URL, cached pages refresh once a day.

A missing or deleted post renders your not-found page. With Cache Components on, Next.js streams it with status 200 and `noindex`, and answers 404 to crawlers that don't stream, such as Twitterbot. With Cache Components off, everyone gets 404.

## API

| Export | Use |
| --- | --- |
| `getAllPosts()` | Every published post, newest first, without bodies |
| `getPosts({ cursor, limit })` | One page of posts; pass `next_cursor` back as `cursor` |
| `getPost(slug)` | One post with its body, or `null` |
| `getStaticSlugs()` | For `generateStaticParams`; never empty, which Cache Components rejects |
| `getArticleMetadata(slug)` | For `generateMetadata`; calls `notFound()` for a missing post |
| `blogSitemap()` | For a `sitemap.ts` route |
| `<ArticleBody post />`, `<ArticleJsonLd post />`, `<FeaturedImage post />` | The body, its structured data, and the featured image |
| `createRevalidateHandler({ secret? })` | The notification route's `POST`; verifies with the read token, or the `whsec_` secret if you pass it |

`KITFUL_READ_TOKEN` is required. `KITFUL_API_URL` defaults to `https://kitful.ai/api/v1`. Post fields are in the [Blog API reference](https://kitful.ai/docs/api/blog).

## Hosting

- **Vercel**: nothing to configure.
- **Several server instances**: use a shared cache handler, so a notification refreshes every instance. Otherwise the others catch up within a day.
- **`output: 'export'`**: not supported; a static export has no server to receive notifications.

## Set it up with an AI coding agent

Paste this into v0, Cursor, Claude Code or a similar tool:

```text
Add a blog to this Next.js app that shows posts published from Kitful, using the npm package
@kitful/next-blog (README: https://github.com/Kitful/next-blog).

1. If the app has a components.json, run: npx shadcn@latest add Kitful/next-blog/blog
   Otherwise install @kitful/next-blog and copy these four files from
   https://github.com/Kitful/next-blog/tree/main/examples/basic/app into the app, keeping
   their paths: blog/page.tsx, blog/[slug]/page.tsx, blog/sitemap.ts and
   api/kitful/revalidate/route.ts. If the app uses src/app, put them under src/app.
2. Add https://img.kitful.ai/** to images.remotePatterns in next.config.
3. Tell me to set my Kitful read token myself as the server-only environment variable
   KITFUL_READ_TOKEN, locally and at my host. Never ask me to paste it into the chat, and
   never put it in client code or commit it.
4. Wrap the blog pages in the site's existing layout and typography. Do not add sample posts.
5. Add /blog to the navigation and /blog/sitemap.xml to robots.
6. Tell me the notification URL to paste into Kitful: <site URL>/api/kitful/revalidate
```

## Development

```bash
bun install
bun run check
```

`check` type-checks, tests and builds the package, then type-checks the example app in `examples/basic`, whose route files `shadcn add` copies.

## License

MIT
