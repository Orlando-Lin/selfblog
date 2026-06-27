"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { NavKey } from "@/lib/site";

export function ComingSoon({ titleKey }: { titleKey: NavKey }) {
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-20">
      <div className="kicker">{t.soon.label}</div>
      <h1 className="display mt-5 text-6xl sm:text-8xl">{t.nav[titleKey]}</h1>
      <p className="mono mt-6 max-w-md text-muted">
        <span className="text-[var(--geek)]">{"// "}</span>
        {t.soon.text}
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-[rgb(var(--line)/0.2)] px-6 py-3 text-sm font-medium transition-colors hover:bg-[rgb(var(--line)/0.05)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.soon.back}
      </Link>
    </div>
  );
}
