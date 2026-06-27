import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import { fromSlug, toSlug } from "@/lib/blog-utils";
import { PostCard } from "@/components/PostCard";
import { Reveal } from "@/components/Reveal";

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ slug: toSlug(tag) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = fromSlug(slug);
  return { title: `#${tag} · 标签`, description: `标签「${tag}」下的全部文章` };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = fromSlug(slug);
  const posts = getPostsByTag(tag);
  if (posts.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12">
      <Link
        href="/blog?view=tags"
        className="mono inline-flex text-sm text-muted hover:text-ink"
      >
        ← cd ../blog
      </Link>
      <header className="py-8">
        <div className="mono-label">tag</div>
        <h1 className="serif-title mt-3 text-4xl">#{tag}</h1>
        <p className="mono mt-3 text-sm text-muted">{posts.length} 篇使用此标签</p>
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
