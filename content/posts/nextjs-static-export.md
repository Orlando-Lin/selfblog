---
title: 用 Next.js 静态导出部署到 GitHub Pages
description: 记录如何把 App Router 项目通过 output export 打包成纯静态站点，并部署到 GitHub Pages。
date: 2026-06-20
category: 技术
tags: [Next.js, GitHub Pages, 部署]
---

很多人以为 Next.js 一定要 Node 服务器才能跑，其实对于博客这类内容站，完全可以导出成纯静态文件。

## 开启静态导出

在 `next.config.ts` 里加上：

```ts
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
```

关键点：

1. `output: "export"` 会在 `next build` 时生成 `out/` 目录；
2. 静态导出不支持 `next/image` 的服务端优化，所以要设 `unoptimized: true`；
3. `trailingSlash` 能让路由在静态托管上更稳定。

## 动态路由怎么办

对于 `blog/[slug]` 这样的动态路由，需要在页面里实现 `generateStaticParams`，把所有 slug 在构建期枚举出来：

```ts
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}
```

## 部署

把 `out/` 目录推到 GitHub Pages 即可，配合 GitHub Actions 可以做到推送即自动部署。如果用了自定义域名，记得保留 `CNAME` 文件。

就是这么简单，享受静态站点的速度与安心吧。
