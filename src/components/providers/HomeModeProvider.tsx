"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type HomeMode = "normal" | "geek";

type HomeModeCtx = {
  mode: HomeMode;
  setMode: (m: HomeMode) => void;
  mounted: boolean;
};

const Ctx = createContext<HomeModeCtx | null>(null);

export function HomeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<HomeMode>("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("home-mode");
    if (stored === "normal" || stored === "geek") setModeState(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.homeMode = mode;
  }, [mode, mounted]);

  const setMode = (m: HomeMode) => {
    setModeState(m);
    localStorage.setItem("home-mode", m);
    document.documentElement.dataset.homeMode = m;
  };

  return (
    <Ctx.Provider value={{ mode, setMode, mounted }}>{children}</Ctx.Provider>
  );
}

export function useHomeMode() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHomeMode must be used within HomeModeProvider");
  return c;
}
