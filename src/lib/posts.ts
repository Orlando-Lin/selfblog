import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { TocItem } from "@/lib/markdown-utils";

export type { TocItem };

const postsDir = path.join(process.cwd(), "content", "posts");
const enPostsDir = path.join(postsDir, "en");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  category: string;
  cover?: string;
  readingTime: number;
};

export type Post = PostMeta & { content: string };

export type PostBundle = {
  slug: string;
  date: string;
  cover?: string;
  zh: PostMeta;
  en: PostMeta | null;
  zhPost: Post;
  enPost: Post | null;
};

function estimateReadingTime(content: string): number {
  const cjk = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (content.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.round((cjk + words) / 350));
}

function readMarkdownFile(filePath: string, slug: string): Post {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ? new Date(data.date).toISOString().slice(0, 10) : "",
    description: data.description ?? "",
    tags: data.tags ?? [],
    category: data.category ?? "未分类",
    cover: data.cover ?? undefined,
    readingTime: estimateReadingTime(content),
    content,
  };
}

function readZhPost(slug: string): Post | null {
  const file = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return readMarkdownFile(file, slug);
}

function readEnPost(slug: string): Post | null {
  const file = path.join(enPostsDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return readMarkdownFile(file, slug);
}

function toMeta(post: Post): PostMeta {
  const { content, ...meta } = post;
  void content;
  return meta;
}

export function getPostBundle(slug: string): PostBundle | null {
  const zhPost = readZhPost(slug);
  if (!zhPost) return null;
  const enPost = readEnPost(slug);
  return {
    slug,
    date: zhPost.date,
    cover: zhPost.cover ?? enPost?.cover,
    zh: toMeta(zhPost),
    en: enPost ? toMeta(enPost) : null,
    zhPost,
    enPost,
  };
}

export function getAllPostBundles(): PostBundle[] {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => getPostBundle(f.replace(/\.md$/, "")))
    .filter((b): b is PostBundle => b !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** @deprecated use getAllPostBundles + pickMeta */
export function getAllPosts(): PostMeta[] {
  return getAllPostBundles().map((b) => b.zh);
}

/** @deprecated use getPostBundle + pickPost */
export function getPost(slug: string): Post | null {
  return readZhPost(slug);
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** @deprecated use getAllPostBundles + getLocalizedCategories */
export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getAllPosts()) {
    for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** @deprecated use getAllPostBundles + getLocalizedCategories */
export function getAllCategories(): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getAllPosts()) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** @deprecated */
export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

/** @deprecated */
export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

/** @deprecated */
export function searchPosts(query: string): PostMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllPosts().filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  );
}
