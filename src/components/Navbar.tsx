"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { site } from "@/lib/site";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { LanguageToggle } from "@/components/controls/LanguageToggle";
import { ModeToggle } from "@/components/controls/ModeToggle";
import {
  BlogMobileLinks,
  BlogNavDropdown,
} from "@/components/blog/BlogNavDropdown";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string, scroll?: boolean) => {
    if (scroll) return false;
    if (href === "/blog") return pathname.startsWith("/blog");
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 transition-all duration-500 ${
          scrolled
            ? "border-[rgb(var(--line)/0.12)] bg-[var(--card)]/85 shadow-lg shadow-black/5 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="mono text-sm text-[var(--geek)]">$</span>
          <span className="font-serif-d text-xl font-bold tracking-tight">
            {site.title}
          </span>
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {site.nav.map((item) =>
            item.key === "blog" ? (
              <BlogNavDropdown key={item.key} />
            ) : (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive(item.href, item.scroll)
                      ? "text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {t.nav[item.key]}
                  {isActive(item.href, item.scroll) && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-[var(--geek)]" />
                  )}
                </Link>
              </li>
            )
          )}
        </ul>

        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <LanguageToggle />
          <ThemeToggle />
          <button
            aria-label={t.ctl.menu}
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[rgb(var(--line)/0.16)] lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="absolute left-4 right-4 top-20 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-[rgb(var(--line)/0.12)] bg-[var(--card)]/95 p-2 backdrop-blur-xl lg:hidden">
          {site.nav.map((item) => (
            <div key={item.key}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                  isActive(item.href, item.scroll) ? "text-ink" : "text-muted"
                }`}
              >
                <span className="mono text-xs text-[var(--geek)]">~/</span>
                {t.nav[item.key]}
              </Link>
              {item.key === "blog" && (
                <BlogMobileLinks onNavigate={() => setOpen(false)} />
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
