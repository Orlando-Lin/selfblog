"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { site } from "@/lib/site";
import { GithubIcon } from "./icons";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { t, lang } = useLanguage();
  return (
    <footer className="relative mt-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rule" />
        <div className="grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-baseline gap-2">
              <span className="mono text-sm text-[var(--geek)]">$</span>
              <span className="font-serif-d text-xl font-bold tracking-tight">
                {site.title}
              </span>
            </div>
            <p className="mt-4 max-w-sm leading-relaxed text-muted">
              {t.footer.tagline}
            </p>
            <p className="mono mt-5 text-xs text-muted">
              <span className="text-[var(--geek)]">~/</span>
              {lang === "zh" ? site.name : site.nameEn} · built with Next.js
            </p>
          </div>

          <div>
            <div className="mono-label mb-4">{t.footer.navigate}</div>
            <ul className="space-y-2.5 text-sm">
              {site.nav.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="text-muted transition-colors hover:text-ink"
                  >
                    {t.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mono-label mb-4">{t.footer.contact}</div>
            <div className="flex gap-3">
              <a
                href={site.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[rgb(var(--line)/0.14)] transition-colors hover:bg-[rgb(var(--line)/0.06)]"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href={`mailto:${site.email}`}
                aria-label="Email"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[rgb(var(--line)/0.14)] transition-colors hover:bg-[rgb(var(--line)/0.06)]"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
            <p className="mono mt-4 text-xs text-muted">{site.email}</p>
          </div>
        </div>

        <div className="rule" />
        <div className="mono flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted sm:flex-row">
          <span>
            © {new Date().getFullYear()} {lang === "zh" ? site.name : site.nameEn}
          </span>
          <span className="text-[var(--geek)]">
            visitor@virongx:~$ <span className="cursor-blink align-middle" />
          </span>
        </div>
      </div>
    </footer>
  );
}
