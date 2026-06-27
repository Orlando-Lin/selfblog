import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { extractHeadings, getAllSlugs, getPost } from "@/lib/posts";
import { Markdown } from "@/components/Markdown";
import { PostToc } from "@/components/blog/PostToc";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "未找到文章" };
  return { title: post.title, description: post.description };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const headings = extractHeadings(post.content);

  const dateText = post.date
    ? new Date(post.date).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <Link
        href="/blog"
        className="mono inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> cd ../blog
      </Link>

      <div className="mt-8 flex gap-12 lg:mt-10">
        {headings.length > 0 && (
          <aside className="hidden w-52 shrink-0 lg:block xl:w-60">
            <PostToc items={headings} />
          </aside>
        )}

        <article className="min-w-0 flex-1">
          <header className="border-b border-[rgb(var(--line)/0.14)] pb-8">
            <div className="mono flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-md bg-[rgb(var(--line)/0.06)] px-2.5 py-1 text-[var(--geek)]">
                {post.category}
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Calendar className="h-3.5 w-3.5" /> {dateText}
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Clock className="h-3.5 w-3.5" /> {post.readingTime} min
              </span>
            </div>
            <h1 className="serif-title mt-5 text-3xl leading-tight sm:text-4xl">
              {post.title}
            </h1>
            {post.description && (
              <p className="mt-4 text-lg leading-relaxed text-muted">
                {post.description}
              </p>
            )}
            {post.tags.length > 0 && (
              <div className="mono mt-5 flex flex-wrap gap-3 text-xs text-muted">
                {post.tags.map((tg) => (
                  <Link
                    key={tg}
                    href={`/blog/tag/${encodeURIComponent(tg)}/`}
                    className="transition-colors hover:text-[var(--geek)]"
                  >
                    #{tg}
                  </Link>
                ))}
              </div>
            )}
          </header>

          <div className="mt-10">
            <Markdown content={post.content} />
          </div>

          <div className="rule mt-14" />
          <Link
            href="/blog"
            className="mono mt-8 inline-flex items-center gap-1.5 text-sm text-[var(--accent)]"
          >
            <ArrowLeft className="h-4 w-4" /> 返回全部文章
          </Link>
        </article>
      </div>
    </div>
  );
}
