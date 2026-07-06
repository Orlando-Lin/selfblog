"use client";

import type { PostBundle } from "@/lib/posts";
import { pickMeta } from "@/lib/post-i18n";
import { PostCard } from "@/components/PostCard";
import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function LocalizedPostGrid({ bundles }: { bundles: PostBundle[] }) {
  const { lang, mounted } = useLanguage();
  const activeLang = mounted ? lang : "zh";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bundles.map((b, i) => (
        <Reveal key={b.slug} className="h-full" delay={(i % 3) * 0.06}>
          <PostCard post={pickMeta(b, activeLang)} index={i} />
        </Reveal>
      ))}
    </div>
  );
}
