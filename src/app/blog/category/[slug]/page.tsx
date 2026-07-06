import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostBundles } from "@/lib/posts";
import { fromSlug, toSlug } from "@/lib/blog-utils";
import { bundleMatchesCategory } from "@/lib/post-i18n";
import { LocalizedPostGrid } from "@/components/blog/LocalizedPostGrid";
import { TaxonomyHeader } from "@/components/blog/TaxonomyHeader";

export function generateStaticParams() {
  const bundles = getAllPostBundles();
  const slugs = new Set<string>();
  for (const b of bundles) {
    slugs.add(toSlug(b.zh.category));
    if (b.en) slugs.add(toSlug(b.en.category));
  }
  return [...slugs].map((slug) => ({ slug }));
}

function resolveCategorySlug(slug: string): string | null {
  const decoded = fromSlug(slug);
  for (const b of getAllPostBundles()) {
    if (toSlug(b.zh.category) === decoded || b.zh.category === decoded) {
      return b.zh.category;
    }
    if (
      b.en &&
      (toSlug(b.en.category) === decoded || b.en.category === decoded)
    ) {
      return b.zh.category;
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
  const name = resolveCategorySlug(slug);
  if (!name) return { title: "分类未找到" };
  return { title: `${name} · 分类`, description: `分类「${name}」下的全部文章` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categoryKey = resolveCategorySlug(slug);
  if (!categoryKey) notFound();

  const bundles = getAllPostBundles().filter((b) =>
    bundleMatchesCategory(b, categoryKey)
  );
  if (bundles.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12">
      <Link
        href="/blog?view=categories"
        className="mono inline-flex text-sm text-muted hover:text-ink"
      >
        ← cd ../blog
      </Link>
      <TaxonomyHeader
        bundles={bundles}
        kind="category"
        filterKey={categoryKey}
      />
      <LocalizedPostGrid bundles={bundles} />
    </div>
  );
}
