---
title: Deploying Next.js Static Export to GitHub Pages
description: How to bundle an App Router project with output export into a pure static site and ship it to GitHub Pages.
date: 2026-06-20
category: Tech
tags: [Next.js, GitHub Pages, Deployment]
---

Many people assume Next.js always needs a Node server. For content sites like blogs, you can export everything as static files.

## Enable Static Export

In `next.config.ts`:

```ts
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
```

Key points:

1. `output: "export"` writes an `out/` folder during `next build`;
2. Static export has no server-side image optimization — set `unoptimized: true`;
3. `trailingSlash` keeps routes stable on static hosts.

## Dynamic Routes

For routes like `blog/[slug]`, implement `generateStaticParams` so every slug is known at build time:

```ts
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}
```

## Deploy

Push the `out/` directory to GitHub Pages. With GitHub Actions you get deploy-on-push. Keep your `CNAME` if you use a custom domain.

That’s it — enjoy the speed and peace of mind of a static site.
