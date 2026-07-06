import type { Lang } from "@/lib/i18n";
import type { Post, PostBundle, PostMeta } from "@/lib/posts";

export function pickMeta(bundle: PostBundle, lang: Lang): PostMeta {
  if (lang === "en" && bundle.en) {
    return {
      ...bundle.en,
      slug: bundle.slug,
      date: bundle.date,
      cover: bundle.en.cover ?? bundle.cover,
    };
  }
  return {
    ...bundle.zh,
    slug: bundle.slug,
    date: bundle.date,
    cover: bundle.cover ?? bundle.zh.cover,
  };
}

export function pickPost(bundle: PostBundle, lang: Lang): Post {
  if (lang === "en" && bundle.enPost) {
    return {
      ...bundle.enPost,
      slug: bundle.slug,
      date: bundle.date,
      cover: bundle.enPost.cover ?? bundle.cover,
    };
  }
  return {
    ...bundle.zhPost,
    slug: bundle.slug,
    date: bundle.date,
    cover: bundle.cover ?? bundle.zhPost.cover,
  };
}

export function getLocalizedCategories(
  bundles: PostBundle[],
  lang: Lang
): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of bundles) {
    const cat = pickMeta(b, lang).category;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getLocalizedTags(
  bundles: PostBundle[],
  lang: Lang
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of bundles) {
    for (const t of pickMeta(b, lang).tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function bundleMatchesCategory(
  bundle: PostBundle,
  name: string | null
): boolean {
  if (!name) return false;
  const zh = bundle.zh.category;
  const en = bundle.en?.category;
  return name === zh || name === en;
}

export function bundleMatchesTag(
  bundle: PostBundle,
  name: string | null
): boolean {
  if (!name) return false;
  return (
    bundle.zh.tags.includes(name) ||
    (bundle.en?.tags.includes(name) ?? false)
  );
}

export function searchBundles(
  bundles: PostBundle[],
  lang: Lang,
  query: string
): PostBundle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return bundles.filter((b) => {
    const meta = pickMeta(b, lang);
    return (
      meta.title.toLowerCase().includes(q) ||
      meta.description.toLowerCase().includes(q)
    );
  });
}

export function resolveDisplayCategory(
  bundles: PostBundle[],
  activeCategory: string | null,
  lang: Lang
): string | null {
  if (!activeCategory) return null;
  for (const b of bundles) {
    if (!bundleMatchesCategory(b, activeCategory)) continue;
    return pickMeta(b, lang).category;
  }
  return activeCategory;
}

export function resolveDisplayTag(
  bundles: PostBundle[],
  activeTag: string | null,
  lang: Lang
): string | null {
  if (!activeTag) return null;
  for (const b of bundles) {
    if (!bundleMatchesTag(b, activeTag)) continue;
    return localizeTagLabel(b, activeTag, lang);
  }
  return activeTag;
}

export function localizeTagLabel(
  bundle: PostBundle,
  tagKey: string,
  lang: Lang
): string {
  const zhTags = bundle.zh.tags;
  const enTags = bundle.en?.tags ?? [];
  const zhIdx = zhTags.indexOf(tagKey);
  const enIdx = enTags.indexOf(tagKey);
  if (lang === "en") {
    if (enIdx >= 0) return enTags[enIdx];
    if (zhIdx >= 0 && enTags[zhIdx]) return enTags[zhIdx];
  }
  if (zhIdx >= 0) return zhTags[zhIdx];
  if (enIdx >= 0) return enTags[enIdx];
  return tagKey;
}

export function localizeCategoryLabel(
  bundle: PostBundle,
  categoryKey: string,
  lang: Lang
): string {
  if (!bundleMatchesCategory(bundle, categoryKey)) return categoryKey;
  return pickMeta(bundle, lang).category;
}
