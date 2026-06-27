import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <div className="mono-label">error 404</div>
      <h1 className="font-serif-d mt-4 text-7xl font-black gradient-text">404</h1>
      <p className="mono mt-4 text-muted">// 页面走丢了，回到熟悉的地方吧</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-paper transition-transform hover:scale-[1.03]"
      >
        cd ~/
      </Link>
    </div>
  );
}
