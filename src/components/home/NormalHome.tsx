"use client";

import { ArrowDown, ArrowUpRight, Mail } from "lucide-react";
import { site } from "@/lib/site";
import { works } from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { GithubIcon } from "@/components/icons";
import { HeroVideo } from "@/components/home/HeroVideo";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function NormalHome() {
  const { t, lang } = useLanguage();

  return (
    <div>
      {/* ===== Hero：文字在前，视频在后 ===== */}
      <section className="relative mx-auto min-h-[min(88vh,820px)] max-w-6xl overflow-hidden px-6 pt-4 pb-16">
        <HeroVideo />
        <div className="relative z-10 flex min-h-[min(80vh,760px)] max-w-3xl flex-col justify-center">
          <Reveal>
            <div className="flex items-center gap-4">
              <span className="kicker">{t.normal.kicker}</span>
              <span className="h-px w-16 bg-[rgb(var(--line)/0.3)]" />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="display mt-6 text-[clamp(2.6rem,8vw,6.5rem)] drop-shadow-sm">
              <span className="block">{t.normal.title1}</span>
              <span className="block italic text-[var(--accent)]">
                {t.normal.title2}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80">
              {t.normal.intro}
            </p>
            <p className="mono mt-3 text-sm text-muted">{t.normal.subtitle}</p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#works"
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper shadow-lg transition-transform hover:scale-[1.03]"
              >
                {t.normal.cta1}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href="#contact"
                className="hover-underline text-sm font-medium"
              >
                {t.normal.cta2}
              </a>
            </div>
          </Reveal>

          <div className="mono mt-auto flex items-center gap-2 pt-10 text-xs text-muted">
            <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
            {t.normal.scroll}
          </div>
        </div>
      </section>

      {/* ===== Works ===== */}
      <section id="works" className="section-anchor mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="kicker">{t.works.kicker}</div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-5xl sm:text-6xl">{t.works.title}</h2>
            <p className="max-w-sm text-muted">{t.works.subtitle}</p>
          </div>
        </Reveal>

        <div className="mt-14">
          <div className="rule" />
          {works.map((w, i) => {
            const inner = (
              <>
                <div className="mono shrink-0 text-sm text-muted md:w-24">
                  {w.year}
                </div>
                <div className="flex-1">
                  <h3 className="font-serif-d text-2xl font-bold tracking-tight transition-colors group-hover:text-[var(--accent)] sm:text-3xl">
                    {w.title[lang]}
                  </h3>
                  <p className="mt-2 max-w-2xl text-muted">{w.desc[lang]}</p>
                  <div className="mono mt-3 flex flex-wrap gap-3 text-xs text-muted">
                    {w.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </div>
                <ArrowUpRight className="mt-1 h-6 w-6 shrink-0 text-muted transition-all group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[var(--accent)]" />
              </>
            );
            const cls =
              "group flex items-start gap-5 py-8 transition-colors";
            return (
              <Reveal key={i} delay={(i % 3) * 0.06}>
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
                <div className="rule" />
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section
        id="contact"
        className="section-anchor mx-auto max-w-6xl px-6 py-24"
      >
        <Reveal>
          <div className="kicker">{t.contact.kicker}</div>
          <h2 className="display mt-4 text-5xl sm:text-7xl">
            {t.contact.title}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {t.contact.text}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <a
            href={`mailto:${site.email}`}
            className="hover-underline mt-10 inline-flex items-center gap-3 font-serif-d text-3xl font-bold tracking-tight sm:text-5xl"
          >
            <Mail className="h-7 w-7 shrink-0 text-[var(--accent)] sm:h-9 sm:w-9" />
            {site.email}
          </a>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--line)/0.2)] px-6 py-3 text-sm font-medium transition-colors hover:bg-[rgb(var(--line)/0.05)]"
            >
              <GithubIcon className="h-4 w-4" /> {t.contact.githubLabel}
            </a>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--line)/0.2)] px-6 py-3 text-sm font-medium transition-colors hover:bg-[rgb(var(--line)/0.05)]"
            >
              <Mail className="h-4 w-4" /> {t.contact.emailLabel}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
