import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPostBundles } from "@/lib/posts";
import { BlogHub } from "@/components/blog/BlogHub";

export const metadata: Metadata = {
  title: "博客",
  description: "技术文章、项目记录与个人思考。",
};

export default function BlogPage() {
  const bundles = getAllPostBundles();

  return (
    <Suspense
      fallback={
        <div className="mono mx-auto max-w-5xl px-4 py-20 text-center text-muted">
          // loading…
        </div>
      }
    >
      <BlogHub bundles={bundles} />
    </Suspense>
  );
}
