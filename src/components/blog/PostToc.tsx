"use client";

import type { TocItem } from "@/lib/markdown-utils";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function PostToc({ items }: { items: TocItem[] }) {
  const { t } = useLanguage();
  if (items.length === 0) return null;

  return (
    <nav className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="mono-label mb-4">{t.blog.toc}</div>
      <ul className="space-y-2 border-l border-[rgb(var(--line)/0.14)] pl-4 text-sm">
        {items.map((h) => (
          <li
            key={h.id}
            style={{ paddingLeft: `${(h.level - 2) * 0.75}rem` }}
          >
            <a
              href={`#${h.id}`}
              className="line-clamp-2 text-muted transition-colors hover:text-[var(--accent)]"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
