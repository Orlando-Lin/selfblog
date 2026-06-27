import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { site } from "@/lib/site";
import { skills } from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { GithubIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "关于",
  description: `关于 ${site.name}`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <Reveal>
        <header className="py-10">
          <div className="mono-label">whoami</div>
          <div className="mt-5 flex items-center gap-5">
            <div className="font-serif-d grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-ink text-3xl font-black text-paper">
              V
            </div>
            <div>
              <h1 className="serif-title text-3xl sm:text-4xl">{site.name}</h1>
              <p className="mono mt-2 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="h-4 w-4" /> 全栈开发 · 街头健身爱好者
              </p>
            </div>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.08}>
        <section className="bento tint-lav">
          <h2 className="serif-title text-xl">你好 👋</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-muted">
            <p>
              我是 {site.name}，一名热爱构建产品、钻研技术的开发者。
              我喜欢把复杂的问题拆解清楚，再用优雅的代码把它们解决。
            </p>
            <p>
              工作之外，我热衷于街头健身（盘杠），相信身体与思维一样需要持续训练。
              这个博客是我的数字花园，记录我学到的、做过的和思考过的一切。
            </p>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.16}>
        <section className="bento mt-4">
          <div className="mono-label">skills</div>
          <div className="mt-5 space-y-4">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="mono text-muted">{s.level}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--line)/0.1)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${s.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.24}>
        <section className="bento tint-mint mt-4">
          <div className="mono-label">contact</div>
          <p className="mt-3 text-sm text-muted">
            欢迎交流技术、合作或单纯聊聊天。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={site.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--line)/0.18)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--line)/0.06)]"
            >
              <GithubIcon className="h-4 w-4" /> GitHub
            </a>
            <a
              href={`mailto:${site.email}`}
              className="mono inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--line)/0.18)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--line)/0.06)]"
            >
              <Mail className="h-4 w-4" /> {site.email}
            </a>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
