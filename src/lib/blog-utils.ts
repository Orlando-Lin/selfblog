export const POSTS_PAGE_SIZE = 10;

export function toSlug(value: string): string {
  return encodeURIComponent(value);
}

export function fromSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
