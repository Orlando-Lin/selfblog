"use client";

import { useHomeMode } from "@/components/providers/HomeModeProvider";

export function Background() {
  const { mode, mounted } = useHomeMode();
  const geek = mounted && mode === "geek";

  return (
    <>
      <div className="bg-layer" aria-hidden />
      <div className="bg-glow" aria-hidden />
      {geek && <div className="bg-grid" aria-hidden />}
      <div className="grain" aria-hidden />
    </>
  );
}
