"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export function LanguageToggle() {
  const { toggle, t, mounted } = useLanguage();
  return (
    <button
      aria-label="切换语言 / Switch language"
      onClick={toggle}
      className="mono grid h-9 min-w-9 place-items-center rounded-lg border border-[rgb(var(--line)/0.16)] px-2 text-xs font-medium transition-colors hover:bg-[rgb(var(--line)/0.06)]"
    >
      {mounted ? t.ctl.lang : "EN"}
    </button>
  );
}
