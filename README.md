# @kitful/next-blog

Show the articles you publish from [Kitful](https://kitful.ai) on your Next.js site. Posts are fetched on the server and cached, and the cache refreshes seconds after you publish, update or delete a post in Kitful.

- Next.js 16 App Router, with Cache Components on or off
- Server-only: your read token never reaches the browser
- SEO included: metadata, canonical URL, Open Graph, JSON-LD and a blog sitemap
- No styles of its own: the HTML takes your site's typography

## Setup

You need a Next.js 16 app and a Kitful site.

1. In Kitful, open **Integrations**, add **Headless**, and enter your blog's address, for example `https://example.com/blog`. For the notification URL, enter your site's address followed by `/api/kitful/revalidate`, for example `https://example.com/api/kitful/revalidate`. Copy the read token Kitful shows; it is shown once.

2. Add the package and the blog routes.

   If your app uses shadcn/ui (it has a `components.json`), one command installs the package and copies the four route files:

   ```bash
   npx shadcn@latest add Kitful/next-blog/blog
   ```

   Otherwise install the package and copy the four files listed under [Route files](#route-files) into your app, keeping their paths:

   ```bash
   npm install @kitful/next-blog
   ```

3. Put the read token in `.env.local` and in your host's environment variables:

   ```bash
   KITFUL_READ_TOKEN=kit_read_...
   ```

4. Allow Kitful's image host in `next.config.ts`:

   ```ts
   import type { NextConfig } from 'next';

   const nextConfig: NextConfig = {
     images: {
       remotePatterns: [new URL('https://img.kitful.ai/**')]
     }
   };

   export default nextConfig;
   ```

5. Deploy. Then open the headless destination in Kitful and press **Send test**: it should report that your site received the notification. Publish an article to the destination and open `/blog`.

## Route files

| File | What it does |
| --- | --- |
| [`app/blog/page.tsx`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/page.tsx) | Lists every post, newest first |
| [`app/blog/[slug]/page.tsx`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/%5Bslug%5D/page.tsx) | Renders one post with its metadata and JSON-LD; prerenders every post at build time |
| [`app/blog/sitemap.ts`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/blog/sitemap.ts) | Serves `/blog/sitemap.xml`; add it to your `robots.ts` |
| [`app/api/kitful/revalidate/route.ts`](https://github.com/Kitful/next-blog/blob/main/examples/basic/app/api/kitful/revalidate/route.ts) | Receives Kitful's signed notification and refreshes the cached pages |

The files are yours to change: wrap them in your layout, add pagination, style the list. The logic stays in the package, so `npm update` brings fixes without touching your pages.

If your app keeps its routes in `src/app`, put the `app/blog` and `app/api/kitful` folders there.

## How it works

Every call is a server-side `fetch` with `cache: 'force-cache'` and cache tags: `kitful:posts` on the post list and `kitful:post:<slug>` on a post. Pages built from them are cached like any static page.

When something changes, Kitful sends a [Standard Webhooks](https://www.standardwebhooks.com/) notification to `/api/kitful/revalidate`. The handler checks the signature with a key derived from your read token, refuses anything older than five minutes, and calls `revalidateTag` for the tags the notification names:

- **published** or **deleted**: the pages expire at once, so a new post appears on the next visit and a deleted one is gone.
- **updated**: the next visit gets the previous version while the new one renders, then every visit after it gets the new one.

Without a notification URL, cached pages still refresh once a day.

A post page looks its slug up in the cached post list before fetching the post, so an unknown slug never costs an extra call to Kitful.

A missing or deleted post renders your not-found page. With `partialPrefetching` on, Next.js streams that page with status 200 and `<meta name="robots" content="noindex">`, and returns a real 404 only to crawlers it treats as HTML-limited, such as Twitterbot. With it off, every visitor gets a 404. This is how Next.js treats any not-found inside a streamed page.

## API

All functions run on the server.

| Export | Use |
| --- | --- |
| `getAllPosts()` | Every published post, newest first, without bodies |
| `getPosts({ cursor, limit })` | One page of posts; pass `next_cursor` back as `cursor` |
| `getPost(slug)` | One post with its body, or `null`. If the returned `slug` differs from the one you asked for, the post was renamed: redirect to it |
| `getStaticSlugs()` | For `generateStaticParams`. Never returns an empty list, which Cache Components would reject |
| `getArticleMetadata(slug)` | For `generateMetadata`: title, description, canonical URL, Open Graph and Twitter cards |
| `blogSitemap()` | For a `sitemap.ts` route |
| `<ArticleBody post />` | The article HTML |
| `<ArticleJsonLd post />` | The post's JSON-LD (BlogPosting and BreadcrumbList) |
| `<FeaturedImage post />` | The featured image through `next/image`, or a plain `<img>` for other hosts |
| `createRevalidateHandler({ secret? })` | The notification route's `POST` handler. Pass `secret` (the `whsec_` value Kitful shows) to verify without the read token |
| `verifyNotification(body, headers, key)` | The signature check on its own |

Environment variables:

| Variable | Required | Meaning |
| --- | --- | --- |
| `KITFUL_READ_TOKEN` | Yes | The read token of your headless destination |
| `KITFUL_API_URL` | No | Defaults to `https://kitful.ai/api/v1` |

The post fields are documented in Kitful's [API reference](https://kitful.ai/docs/api/blog).

## Hosting

- **Vercel**: nothing to configure.
- **More than one server instance**: `revalidateTag` clears the cache of the instance that received the notification. Configure a shared cache handler so every instance reads the same cache; otherwise the other instances catch up within a day.
- **`output: 'export'`**: not supported, since a static export has no server to receive notifications.

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
3. Ask me for my Kitful read token and store it as the server-only environment variable
   KITFUL_READ_TOKEN. Never put it in client code or commit it.
4. Wrap the blog pages in the site's existing layout and typography. Do not add sample posts.
5. Add /blog to the navigation and /blog/sitemap.xml to robots.
6. Tell me the notification URL to paste into Kitful: <site URL>/api/kitful/revalidate
```

## Development

```bash
bun install
bun run check
```

`check` runs the type check, the tests and the build of `packages/next-blog`. The example app in `examples/basic` holds the route files that `shadcn add` copies.

## License

MIT
