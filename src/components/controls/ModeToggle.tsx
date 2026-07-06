"use client";

import { useTheme } from "next-themes";
import { Newspaper, TerminalSquare } from "lucide-react";
import { useHomeMode, type HomeMode } from "@/components/providers/HomeModeProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ModeToggle() {
  const { mode, setMode, mounted } = useHomeMode();
  const { setTheme } = useTheme();
  const { t } = useLanguage();

  const choose = (m: HomeMode) => {
    setMode(m);
    // each mode has a sensible default theme; user can still override afterwards
    setTheme(m === "geek" ? "dark" : "light");
  };

  const current = mounted ? mode : "normal";

  const items: { id: HomeMode; label: string; icon: typeof Newspaper }[] = [
    { id: "normal", label: t.ctl.normal, icon: Newspaper },
    { id: "geek", label: t.ctl.geek, icon: TerminalSquare },
  ];

  return (
    <div className="flex items-center rounded-lg border border-[rgb(var(--line)/0.16)] p-0.5">
      {items.map((it) => {
        const active = current === it.id;
        return (
          <button
            key={it.id}
            onClick={() => choose(it.id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-ink text-paper"
                : "text-muted hover:text-ink"
            }`}
          >
            <it.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
