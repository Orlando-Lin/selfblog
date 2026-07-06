import GithubSlugger from "github-slugger";

export const POSTS_PAGE_SIZE = 10;

/** Filesystem-safe slug; CJK labels keep raw text for GitHub Pages static paths. */
export function toSlug(value: string): string {
  const slug = new GithubSlugger().slug(value.trim());
  return slug || value.trim();
}

export function fromSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function blogCategoryUrl(category: string): string {
  return `/blog?category=${encodeURIComponent(category)}`;
}

export function blogTagUrl(tag: string): string {
  return `/blog?tag=${encodeURIComponent(tag)}`;
}
