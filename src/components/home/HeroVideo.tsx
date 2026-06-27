"use client";

export function HeroVideo() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <video
        className="h-full w-full object-cover opacity-[0.35] dark:opacity-[0.22]"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/poster.jpg"
      >
        <source src="/hero/hero.mp4" type="video/mp4" />
        <source src="/hero/hero.webm" type="video/webm" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--paper)] via-[var(--paper)]/88 to-[var(--paper)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--paper)]/95 via-transparent to-[var(--paper)]/70" />
    </div>
  );
}
