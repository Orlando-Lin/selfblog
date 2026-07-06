import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllCategories, getPostsByCategory } from "@/lib/posts";
import { blogCategoryUrl, fromSlug, toSlug } from "@/lib/blog-utils";import { PostCard } from "@/components/PostCard";
import { Reveal } from "@/components/Reveal";

export function generateStaticParams() {
  return getAllCategories().map(({ category }) => ({
    slug: toSlug(category),
  }));
}

function resolveCategory(slug: string): string | null {
  const decoded = fromSlug(slug);
  const match = getAllCategories().find(
    ({ category }) => toSlug(category) === decoded || category === decoded
  );
  return match?.category ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = resolveCategory(slug);
  if (!name) return { title: "分类未找到" };
  return { title: `${name} · 分类`, description: `分类「${name}」下的全部文章` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = resolveCategory(slug);
  if (!category) notFound();

  const posts = getPostsByCategory(category);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12">
      <Link
        href="/blog?view=categories"
        className="mono inline-flex text-sm text-muted hover:text-ink"
      >
        ← cd ../blog
      </Link>
      <header className="py-8">
        <div className="mono-label">category</div>
        <h1 className="serif-title mt-3 text-4xl">{category}</h1>
        <p className="mono mt-3 text-sm text-muted">{posts.length} 篇在此分类</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p, i) => (
          <Reveal key={p.slug} className="h-full" delay={(i % 3) * 0.06}>
            <PostCard post={p} index={i} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
