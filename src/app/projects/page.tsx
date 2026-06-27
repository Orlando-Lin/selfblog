import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { projects } from "@/lib/data";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "项目",
  description: "亲手打造的开源项目与作品集。",
};

const statusColor: Record<string, string> = {
  进行中: "text-amber-500 dark:text-amber-400",
  已上线: "text-emerald-600 dark:text-emerald-400",
  实验: "text-sky-600 dark:text-sky-400",
};

const tints = ["tint-lav", "tint-mint", "tint-peach", "tint-sky", "tint-butter", "tint-rose"];

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <Reveal>
        <header className="py-10">
          <div className="mono-label">ls ~/projects</div>
          <h1 className="serif-title mt-3 text-4xl sm:text-5xl">项目</h1>
          <p className="mt-4 text-muted">从想法到上线，记录每一个亲手打造的作品。</p>
        </header>
      </Reveal>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
        {projects.map((p, i) => {
          const inner = (
            <>
              <div className="mono flex items-center justify-between text-xs">
                <span className={statusColor[p.status]}>● {p.status}</span>
                {p.link && (
                  <ArrowUpRight className="h-5 w-5 text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                )}
              </div>
              <h3 className="serif-title mt-4 text-2xl transition-colors group-hover:text-[var(--accent)]">
                {p.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {p.description}
              </p>
              <div className="mono mt-5 flex flex-wrap gap-2 text-xs text-muted">
                {p.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </>
          );
          const cls = `bento bento-hover ${tints[i % tints.length]} group flex h-full flex-col`;
          return (
            <Reveal key={p.title} className="h-full" delay={(i % 2) * 0.08}>
              {p.link ? (
                <a href={p.link} target="_blank" rel="noopener noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
