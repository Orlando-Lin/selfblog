import GithubSlugger from "github-slugger";

export type TocItem = { level: number; text: string; id: string };

function slugifyHeading(text: string): string {
  return new GithubSlugger().slug(text);
}

export function extractHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^(#{2,4})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/\s*#+\s*$/, "").trim();
    if (level >= 2 && level <= 4) {
      items.push({ level, text, id: slugifyHeading(text) });
    }
  }
  return items;
}
