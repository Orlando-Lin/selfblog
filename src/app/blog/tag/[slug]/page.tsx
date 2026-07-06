import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostBundles } from "@/lib/posts";
import { fromSlug, toSlug } from "@/lib/blog-utils";
import { bundleMatchesTag } from "@/lib/post-i18n";
import { LocalizedPostGrid } from "@/components/blog/LocalizedPostGrid";
import { TaxonomyHeader } from "@/components/blog/TaxonomyHeader";

export function generateStaticParams() {
  const bundles = getAllPostBundles();
  const slugs = new Set<string>();
  for (const b of bundles) {
    for (const t of b.zh.tags) slugs.add(toSlug(t));
    for (const t of b.en?.tags ?? []) slugs.add(toSlug(t));
  }
  return [...slugs].map((slug) => ({ slug }));
}

function resolveTagSlug(slug: string): string | null {
  const decoded = fromSlug(slug);
  for (const b of getAllPostBundles()) {
    for (const t of b.zh.tags) {
      if (toSlug(t) === decoded || t === decoded) return t;
    }
    for (const t of b.en?.tags ?? []) {
      if (toSlug(t) === decoded || t === decoded) return t;
    }
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = resolveTagSlug(slug);
  if (!tag) return { title: "标签未找到" };
  return { title: `#${tag} · 标签`, description: `标签「${tag}」下的全部文章` };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tagKey = resolveTagSlug(slug);
  if (!tagKey) notFound();

  const bundles = getAllPostBundles().filter((b) =>
    bundleMatchesTag(b, tagKey)
  );
  if (bundles.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12">
      <Link
        href="/blog?view=tags"
        className="mono inline-flex text-sm text-muted hover:text-ink"
      >
        ← cd ../blog
      </Link>
      <TaxonomyHeader bundles={bundles} kind="tag" filterKey={tagKey} />
      <LocalizedPostGrid bundles={bundles} />
    </div>
  );
}
