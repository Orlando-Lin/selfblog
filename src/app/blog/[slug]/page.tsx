import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllSlugs, getPostBundle } from "@/lib/posts";
import { PostArticle } from "@/components/blog/PostArticle";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getPostBundle(slug);
  if (!bundle) return { title: "未找到文章" };
  return { title: bundle.zh.title, description: bundle.zh.description };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = getPostBundle(slug);
  if (!bundle) notFound();

  return <PostArticle bundle={bundle} />;
}
