"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Hash,
  List,
  Search,
} from "lucide-react";
import type { PostMeta } from "@/lib/posts";
import { POSTS_PAGE_SIZE, toSlug } from "@/lib/blog-utils";
import { PostCard } from "@/components/PostCard";
import { useLanguage } from "@/components/providers/LanguageProvider";

export type BlogView = "articles" | "categories" | "tags" | "search";

type Props = {
  posts: PostMeta[];
  categories: { category: string; count: number }[];
  tags: { tag: string; count: number }[];
  initialView?: BlogView;
  initialQuery?: string;
  initialPage?: number;
};

const tabs: { id: BlogView; icon: typeof List }[] = [
  { id: "articles", icon: List },
  { id: "categories", icon: FolderOpen },
  { id: "tags", icon: Hash },
  { id: "search", icon: Search },
];

export function BlogHub({
  posts,
  categories,
  tags,
  initialView = "articles",
  initialQuery = "",
  initialPage = 1,
}: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<BlogView>(initialView);
  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);

  useEffect(() => {
    const v = searchParams.get("view") as BlogView | null;
    if (v && tabs.some((tab) => tab.id === v)) setView(v);
    const q = searchParams.get("q") ?? "";
    setQuery(q);
    setDraft(q);
    const p = Number(searchParams.get("page") ?? "1");
    setPage(Number.isFinite(p) && p > 0 ? p : 1);
  }, [searchParams]);

  const syncUrl = useCallback(
    (next: { view?: BlogView; page?: number; q?: string }) => {
      const params = new URLSearchParams();
      const v = next.view ?? view;
      params.set("view", v);
      if (v === "articles") {
        const pg = next.page ?? page;
        if (pg > 1) params.set("page", String(pg));
      }
      if (v === "search") {
        const qq = next.q ?? query;
        if (qq) params.set("q", qq);
      }
      const qs = params.toString();
      router.replace(qs ? `/blog?${qs}` : "/blog", { scroll: false });
    },
    [view, page, query, router]
  );

  const switchView = (v: BlogView) => {
    setView(v);
    setPage(1);
    syncUrl({ view: v, page: 1 });
  };

  const filtered = useMemo(() => {
    if (view !== "search") return posts;
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return posts.filter((p) => p.title.toLowerCase().includes(q));
  }, [posts, view, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePosts = filtered.slice(
    (safePage - 1) * POSTS_PAGE_SIZE,
    safePage * POSTS_PAGE_SIZE
  );

  const tabLabel = (id: BlogView) => t.blog[id];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12">
      <header className="py-8">
        <div className="mono-label">ls ~/blog</div>
        <h1 className="serif-title mt-3 text-4xl sm:text-5xl">{t.blog.title}</h1>
        <p className="mono mt-3 text-sm text-muted">{t.blog.subtitle}</p>
      </header>

      {/* Tab bar — mirrors nav dropdown */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-[rgb(var(--line)/0.12)] pb-4">
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchView(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              view === id
                ? "bg-ink text-paper"
                : "text-muted hover:bg-[rgb(var(--line)/0.06)] hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tabLabel(id)}
          </button>
        ))}
      </div>

      {view === "articles" && (
        <>
          <p className="mono mb-6 text-xs text-muted">{t.blog.articlesDesc}</p>
          {pagePosts.length === 0 ? (
            <Empty msg={t.blog.noPosts} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagePosts.map((p, i) => (
                <PostCard
                  key={p.slug}
                  post={p}
                  index={(safePage - 1) * POSTS_PAGE_SIZE + i}
                />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <Pager
              page={safePage}
              total={totalPages}
              onChange={(p) => {
                setPage(p);
                syncUrl({ page: p });
              }}
              prev={t.blog.prev}
              next={t.blog.next}
              pageLabel={t.blog.page.replace("{n}", String(safePage))}
            />
          )}
        </>
      )}

      {view === "categories" && (
        <>
          <p className="mono mb-6 text-xs text-muted">{t.blog.categoriesDesc}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map(({ category, count }) => (
              <Link
                key={category}
                href={`/blog/category/${toSlug(category)}/`}
                className="group flex items-center justify-between rounded-xl border border-[rgb(var(--line)/0.14)] bg-[var(--card)] p-5 transition-all hover:-translate-y-0.5 hover:border-[rgb(var(--line)/0.28)]"
              >
                <span className="font-serif-d text-xl font-bold group-hover:text-[var(--accent)]">
                  {category}
                </span>
                <span className="mono text-sm text-muted">
                  {count} {t.blog.postsCount}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {view === "tags" && (
        <>
          <p className="mono mb-6 text-xs text-muted">{t.blog.tagsDesc}</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/blog/tag/${toSlug(tag)}/`}
                className="mono inline-flex items-center gap-2 rounded-full border border-[rgb(var(--line)/0.14)] px-4 py-2 text-sm transition-colors hover:border-[var(--geek)] hover:text-[var(--geek)]"
              >
                #{tag}
                <span className="rounded-md bg-[rgb(var(--line)/0.08)] px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {view === "search" && (
        <>
          <p className="mono mb-4 text-xs text-muted">{t.blog.searchDesc}</p>
          <form
            className="mb-8 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(draft);
              setPage(1);
              syncUrl({ view: "search", q: draft, page: 1 });
            }}
          >
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.blog.searchPlaceholder}
              className="min-w-[min(100%,16rem)] flex-1 rounded-xl border border-[rgb(var(--line)/0.18)] bg-[var(--card)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="rounded-xl bg-ink px-6 py-3 text-sm font-medium text-paper"
            >
              {t.blog.searchBtn}
            </button>
          </form>
          {query && pagePosts.length === 0 ? (
            <Empty msg={t.blog.empty} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pagePosts.map((p, i) => (
                <PostCard key={p.slug} post={p} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="mono py-16 text-center text-muted">{"// "}{msg}</p>;
}

function Pager({
  page,
  total,
  onChange,
  prev,
  next,
  pageLabel,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  prev: string;
  next: string;
  pageLabel: string;
}) {
  return (
    <div className="mono mt-10 flex items-center justify-center gap-4 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--line)/0.14)] px-3 py-2 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" /> {prev}
      </button>
      <span className="text-muted">{pageLabel}</span>
      <button
        type="button"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
        className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--line)/0.14)] px-3 py-2 disabled:opacity-40"
      >
        {next} <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
