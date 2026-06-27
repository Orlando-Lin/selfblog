"use client";

import { ArrowUpRight, Mail } from "lucide-react";
import { site } from "@/lib/site";
import { works } from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { GithubIcon } from "@/components/icons";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function GeekHome() {
  const { t, lang } = useLanguage();

  return (
    <div>
      {/* ===== Hero: terminal window ===== */}
      <section className="mx-auto flex min-h-[78vh] max-w-3xl flex-col justify-center px-4">
        <Reveal>
          <div className="terminal">
            <div className="terminal-bar">
              <span className="win-dot bg-[#ff5f57]" />
              <span className="win-dot bg-[#febc2e]" />
              <span className="win-dot bg-[#28c840]" />
              <span className="mono ml-3 text-xs text-muted">
                {site.name.toLowerCase()}@virongx: ~
              </span>
            </div>

            <div className="mono space-y-3 p-6 text-sm leading-relaxed sm:p-8">
              <p>
                <span className="term-green">visitor@virongx</span>:
                <span className="term-accent">~</span>${" "}
                <span className="text-ink">{t.geek.typed}</span>
              </p>

              <div className="pl-0">
                <p className="font-serif-d text-3xl font-black tracking-tight text-ink sm:text-4xl">
                  {lang === "zh" ? site.name : site.nameEn}{" "}
                  <span className="term-green">/ VIRONGX</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-muted">
                  <li>
                    <span className="term-accent">role</span>
                    {"   "}: {t.geek.role}
                  </li>
                  <li>
                    <span className="term-accent">stack</span>
                    {"  "}: {t.geek.stack}
                  </li>
                  <li>
                    <span className="term-accent">loc</span>
                    {"    "}: {t.geek.location}
                  </li>
                </ul>
                <p className="mt-4 text-muted">{t.geek.tagline}</p>
              </div>

              <p>
                <span className="term-green">visitor@virongx</span>:
                <span className="term-accent">~</span>${" "}
                <span className="cursor-blink align-middle" />
              </p>

              <div className="flex flex-wrap gap-3 pt-3">
                <a
                  href="#works"
                  className="rounded-md border border-[rgb(var(--line)/0.2)] px-4 py-2 text-xs transition-colors hover:bg-[rgb(var(--line)/0.06)]"
                >
                  <span className="term-green">$</span> {t.geek.runWorks}
                </a>
                <a
                  href="#contact"
                  className="rounded-md border border-[rgb(var(--line)/0.2)] px-4 py-2 text-xs transition-colors hover:bg-[rgb(var(--line)/0.06)]"
                >
                  <span className="term-green">$</span> {t.geek.runContact}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== Works ===== */}
      <section id="works" className="section-anchor mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <div className="mono mb-2 text-xs text-muted">
            <span className="term-green">$</span> ls ~/works
          </div>
          <h2 className="mono text-3xl font-bold tracking-tight">
            <span className="term-green">#</span> {t.works.title}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {works.map((w, i) => {
            const inner = (
              <>
                <div className="mono flex items-center justify-between text-xs text-muted">
                  <span className="term-green">{w.year}</span>
                  <ArrowUpRight className="h-4 w-4 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--geek)]" />
                </div>
                <h3 className="mono mt-4 text-lg font-bold transition-colors group-hover:text-[var(--geek)]">
                  {w.title[lang]}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {w.desc[lang]}
                </p>
                <div className="mono mt-4 flex flex-wrap gap-2 text-xs text-muted">
                  {w.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              </>
            );
            const cls =
              "group flex h-full flex-col rounded-xl border border-[rgb(var(--line)/0.16)] bg-[var(--card)] p-6 transition-all hover:border-[rgb(var(--line)/0.3)] hover:-translate-y-1";
            return (
              <Reveal key={i} className="h-full" delay={(i % 2) * 0.08}>
                {w.link ? (
                  <a
                    href={w.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls}
                  >
                    {inner}
                  </a>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section
        id="contact"
        className="section-anchor mx-auto max-w-5xl px-4 py-20"
      >
        <Reveal>
          <div className="terminal">
            <div className="terminal-bar">
              <span className="win-dot bg-[#ff5f57]" />
              <span className="win-dot bg-[#febc2e]" />
              <span className="win-dot bg-[#28c840]" />
              <span className="mono ml-3 text-xs text-muted">contact.sh</span>
            </div>
            <div className="mono space-y-3 p-6 text-sm sm:p-8">
              <p className="text-muted">
                <span className="term-green">$</span> cat contact.txt
              </p>
              <p className="text-muted">{t.contact.text}</p>
              <div className="space-y-2 pt-2">
                <a
                  href={`mailto:${site.email}`}
                  className="flex items-center gap-3 transition-colors hover:text-[var(--geek)]"
                >
                  <Mail className="h-4 w-4 text-[var(--accent)]" />
                  <span className="term-accent">email</span> → {site.email}
                </a>
                <a
                  href={site.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 transition-colors hover:text-[var(--geek)]"
                >
                  <GithubIcon className="h-4 w-4 text-[var(--accent)]" />
                  <span className="term-accent">github</span> → {site.github}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
