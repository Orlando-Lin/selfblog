import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const postsDir = path.join(process.cwd(), "content", "posts");

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

export type TocItem = { level: number; text: string; id: string };

function estimateReadingTime(content: string): number {
  // mixed CN/EN: count CJK chars + words, ~350 cpm
  const cjk = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (content.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.round((cjk + words) / 350));
}

function readPostFile(fileName: string): Post {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(postsDir, fileName), "utf8");
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

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const { content, ...meta } = readPostFile(f);
      void content;
      return meta;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | null {
  const file = path.join(postsDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return readPostFile(`${slug}.md`);
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(postsDir)) return [];
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""));
}

function slugifyHeading(text: string): string {
  return new GithubSlugger().slug(text);
}

export function extractHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^(2,4})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/\s*#+\s*$/, "").trim();
    if (level >= 2 && level <= 4) {
      items.push({ level, text, id: slugifyHeading(text) });
    }
  }
  return items;
}

export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getAllPosts()) {
    for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAllCategories(): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getAllPosts()) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

export function searchPosts(query: string): PostMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllPosts().filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
  );
}
