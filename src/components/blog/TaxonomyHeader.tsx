"use client";

import type { PostBundle } from "@/lib/posts";
import {
  localizeCategoryLabel,
  localizeTagLabel,
} from "@/lib/post-i18n";
import { useLanguage } from "@/components/providers/LanguageProvider";

type Props = {
  bundles: PostBundle[];
  kind: "category" | "tag";
  filterKey: string;
};

export function TaxonomyHeader({ bundles, kind, filterKey }: Props) {
  const { lang, mounted, t } = useLanguage();
  const activeLang = mounted ? lang : "zh";
  const sample = bundles[0];

  const label = sample
    ? kind === "category"
      ? localizeCategoryLabel(sample, filterKey, activeLang)
      : `#${localizeTagLabel(sample, filterKey, activeLang)}`
    : kind === "tag"
      ? `#${filterKey}`
      : filterKey;

  const countLabel =
    kind === "category"
      ? `${bundles.length} ${t.blog.postsInCategory}`
      : `${bundles.length} ${t.blog.postsWithTag}`;

  return (
    <header className="py-8">
      <div className="mono-label">{kind}</div>
      <h1 className="serif-title mt-3 text-4xl">{label}</h1>
      <p className="mono mt-3 text-sm text-muted">{countLabel}</p>
    </header>
  );
}
