import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { hzbarMoves } from "@/lib/data";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "盘杠",
  description: "街头健身 · 单双杠训练动作与心得。",
};

const levelColor: Record<string, string> = {
  入门: "text-emerald-600 dark:text-emerald-400",
  进阶: "text-amber-500 dark:text-amber-400",
  高手: "text-rose-600 dark:text-rose-400",
};

const tints = ["tint-rose", "tint-peach", "tint-butter", "tint-mint", "tint-sky", "tint-lav"];

export default function HzbarPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <Reveal>
        <header className="py-10">
          <div className="mono-label">street_workout</div>
          <h1 className="serif-title mt-3 flex items-center gap-3 text-4xl sm:text-5xl">
            <Dumbbell className="h-8 w-8 text-[var(--accent)]" /> 盘杠
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-muted">
            在杠上书写身体的语言。这里记录我的街头健身之路——
            从一个引体向上，到征服每一个静力控制动作。
          </p>
        </header>
      </Reveal>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
        {hzbarMoves.map((m, i) => (
          <Reveal key={m.name} className="h-full" delay={(i % 2) * 0.08}>
            <div className={`bento bento-hover ${tints[i % tints.length]} flex h-full flex-col`}>
              <div className="flex items-center justify-between">
                <h3 className="serif-title text-xl">{m.name}</h3>
                <span className={`mono text-xs ${levelColor[m.level]}`}>
                  ● {m.level}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{m.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="bento scanlines mt-4 text-center">
          <blockquote className="font-serif-d text-lg italic text-muted">
            「自律给我自由。」持续训练，享受每一次突破极限的瞬间。
          </blockquote>
        </div>
      </Reveal>
    </div>
  );
}
