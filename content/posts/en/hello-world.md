---
title: Hello, New Blog
description: The personal blog rebuilt with Next.js 16 + Tailwind v4 is live — why I started over and how I chose the stack.
date: 2026-06-24
category: Essay
tags: [Next.js, Site Building, DIY]
---

After a long break, my personal blog has been completely rebuilt. This time I left Jekyll behind for a more modern stack.

## Why Rebuild

The old Jekyll site worked, but a few things kept bothering me:

- Themes were hard to customize — fancy motion effects were painful to add;
- Local dev was mediocre, and the Ruby toolchain was annoying to maintain;
- No real component model, so reuse and maintenance cost more than it should.

So I decided to start fresh with tools I enjoy and that feel future-proof.

## New Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Motion | Framer Motion |
| Content | Markdown + gray-matter |
| Deploy | GitHub Pages (static export) |

> Visually it’s glassmorphism + minimal elegance, with gradient glow backgrounds and dark mode.

## What’s Next

I’ll gradually migrate old notes, projects, and some calisthenics content. If you like tinkering with side projects, drop by often.

```ts
// sample snippet
export function greet(name: string) {
  return `Hello, ${name}! Welcome to my digital garden.`;
}
```

Thanks for reading — see you in the next post.
