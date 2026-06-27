"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { dict, type Dict, type Lang } from "@/lib/i18n";

type LanguageCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: Dict;
  mounted: boolean;
};

const Ctx = createContext<LanguageCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "zh" || stored === "en") setLangState(stored);
    setMounted(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  };

  const toggle = () => setLang(lang === "zh" ? "en" : "zh");

  return (
    <Ctx.Provider value={{ lang, setLang, toggle, t: dict[lang], mounted }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLanguage() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLanguage must be used within LanguageProvider");
  return c;
}
