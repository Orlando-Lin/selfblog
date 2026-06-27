import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PostMeta } from "@/lib/posts";

function fmt(date: string) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function PostCard({
  post,
  index,
}: {
  post: PostMeta;
  index?: number;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group bento bento-hover flex flex-col"
    >
      <div className="mono flex items-center gap-2 text-xs text-muted">
        {typeof index === "number" && (
          <span className="text-[var(--geek)]">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <span>{fmt(post.date)}</span>
        <span className="ml-auto rounded-md bg-[rgb(var(--line)/0.06)] px-2 py-0.5">
          {post.category}
        </span>
      </div>

      <h3 className="serif-title mt-4 text-xl transition-colors group-hover:text-[var(--accent)]">
        {post.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
        {post.description}
      </p>

      <div className="mono mt-auto flex items-center gap-2 pt-5 text-xs text-muted">
        {post.tags.slice(0, 2).map((t) => (
          <span key={t}>#{t}</span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {post.readingTime} min
          <ArrowUpRight className="h-3.5 w-3.5 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
        </span>
      </div>
    </Link>
  );
}
