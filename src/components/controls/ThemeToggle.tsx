"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="切换亮暗主题"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid h-9 w-9 place-items-center rounded-lg border border-[rgb(var(--line)/0.16)] transition-colors hover:bg-[rgb(var(--line)/0.06)]"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4 text-amber-300" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-500" />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
