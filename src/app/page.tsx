"use client";

import { useHomeMode } from "@/components/providers/HomeModeProvider";
import { NormalHome } from "@/components/home/NormalHome";
import { GeekHome } from "@/components/home/GeekHome";

export default function Home() {
  const { mode, mounted } = useHomeMode();
  const showGeek = mounted && mode === "geek";
  return showGeek ? <GeekHome /> : <NormalHome />;
}
