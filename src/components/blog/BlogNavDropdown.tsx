"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FolderOpen, Hash, List, Search } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { BlogView } from "@/components/blog/BlogHub";

const items: { view: BlogView; icon: typeof List; href: string }[] = [
  { view: "articles", icon: List, href: "/blog" },
  { view: "categories", icon: FolderOpen, href: "/blog?view=categories" },
  { view: "tags", icon: Hash, href: "/blog?view=tags" },
  { view: "search", icon: Search, href: "/blog?view=search" },
];

export function BlogNavDropdown() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const active = pathname.startsWith("/blog");

  return (
    <li
      className="relative"
      onMouseEnter={(e) => {
        const panel = e.currentTarget.querySelector("[data-panel]");
        panel?.classList.remove("hidden");
      }}
      onMouseLeave={(e) => {
        const panel = e.currentTarget.querySelector("[data-panel]");
        panel?.classList.add("hidden");
      }}
    >
      <Link
        href="/blog"
        className={`relative inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          active ? "text-ink" : "text-muted hover:text-ink"
        }`}
      >
        {t.nav.blog}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        {active && (
          <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-[var(--geek)]" />
        )}
      </Link>

      <div
        data-panel
        className="absolute left-0 top-full z-50 mt-2 hidden min-w-[15rem] rounded-xl border border-[rgb(var(--line)/0.12)] bg-[var(--card)]/95 p-2 shadow-xl backdrop-blur-xl"
      >
        <p className="mono px-3 py-1.5 text-[0.65rem] uppercase tracking-widest text-muted">
          {t.blog.subtitle}
        </p>
        {items.map(({ view, icon: Icon, href }) => (
          <Link
            key={view}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-[rgb(var(--line)/0.06)] hover:text-ink"
          >
            <Icon className="h-4 w-4 text-[var(--geek)]" />
            <span>{t.blog[view]}</span>
          </Link>
        ))}
      </div>
    </li>
  );
}

/** Mobile blog sub-links */
export function BlogMobileLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="ml-4 space-y-1 border-l border-[rgb(var(--line)/0.12)] pl-3">
      {items.map(({ view, icon: Icon, href }) => (
        <Link
          key={view}
          href={href}
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted"
        >
          <Icon className="h-3.5 w-3.5" />
          {t.blog[view]}
        </Link>
      ))}
    </div>
  );
}
