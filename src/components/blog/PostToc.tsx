"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TocItem } from "@/lib/markdown-utils";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function PostToc({ items }: { items: TocItem[] }) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const idsKey = items.map((item) => item.id).join("|");

  const hasH2 = items.some((item) => item.level === 2);
  const hasChildren = items.some((item) => item.level > 2);
  // 没有二级标题时无从折叠，直接全展示
  const open = expanded || !hasH2;
  const canToggle = hasH2 && hasChildren;
  const visibleItems = open ? items : items.filter((item) => item.level <= 2);

  // 折叠状态下，小节的高亮上提到它所属的章节
  let displayActiveId = activeId;
  if (!open && activeId) {
    const index = items.findIndex((item) => item.id === activeId);
    if (index >= 0 && items[index].level > 2) {
      for (let i = index; i >= 0; i -= 1) {
        if (items[i].level <= 2) {
          displayActiveId = items[i].id;
          break;
        }
      }
    }
  }

  // 跟随页面滚动：标出当前正在阅读的章节（始终遍历全部标题）
  useEffect(() => {
    if (!idsKey) return;

    const elements = idsKey
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      // 与标题的 scroll-margin-top 大致对齐，标题越过这条线就算“当前章节”
      const activationLine = 130;
      let current = elements[0].id;

      for (const el of elements) {
        if (el.getBoundingClientRect().top > activationLine) break;
        current = el.id;
      }

      // 滚到底部时，最后几个短章节可能永远越不过判定线
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 8) {
        current = elements[elements.length - 1].id;
      }

      setActiveId(current);
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [idsKey]);

  // 目录比视口长时，让高亮项留在可视区域内（展开/收起后也要重新对齐）
  useEffect(() => {
    if (!displayActiveId) return;

    const nav = navRef.current;
    const link = linkRefs.current[displayActiveId];
    if (!nav || !link) return;

    const linkRect = link.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const pad = 24;

    if (linkRect.top < navRect.top + pad) {
      nav.scrollTop -= navRect.top + pad - linkRect.top;
    } else if (linkRect.bottom > navRect.bottom - pad) {
      nav.scrollTop += linkRect.bottom - (navRect.bottom - pad);
    }
  }, [displayActiveId, open]);

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="mono-label">{t.blog.toc}</div>
        {canToggle && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={open}
            className="mono flex shrink-0 items-center gap-0.5 text-[11px] text-muted transition-colors hover:text-[var(--accent)]"
          >
            {open ? t.blog.tocCollapse : t.blog.tocExpand}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>
      <ul className="space-y-2 border-l border-[rgb(var(--line)/0.14)] pl-4 text-sm">
        {visibleItems.map((h) => {
          const active = h.id === displayActiveId;
          return (
            <li
              key={h.id}
              className={
                active
                  ? "relative before:absolute before:-left-4 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--accent)] before:content-['']"
                  : "relative"
              }
              style={{ paddingLeft: `${(h.level - 2) * 0.75}rem` }}
            >
              <a
                ref={(el) => {
                  linkRefs.current[h.id] = el;
                }}
                href={`#${h.id}`}
                onClick={() => setActiveId(h.id)}
                aria-current={active ? "location" : undefined}
                className={
                  active
                    ? "line-clamp-2 font-medium text-[var(--accent)]"
                    : "line-clamp-2 text-muted transition-colors hover:text-[var(--accent)]"
                }
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
