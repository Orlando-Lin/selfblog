export type NavKey =
  | "home"
  | "blog"
  | "toolbox"
  | "heritage"
  | "works"
  | "contact";

export type NavItem = {
  key: NavKey;
  href: string;
  /** scroll to a section on the homepage instead of navigating to a page */
  scroll?: boolean;
};

export const site = {
  title: "VIRONGX",
  name: "曹淋锦荣",
  nameEn: "Cao Linjinrong",
  email: "Cao_mouiller@163.com",
  url: "https://www.virongx.com",
  github: "https://github.com/Orlando-Lin",
  nav: [
    { key: "home", href: "/" },
    { key: "blog", href: "/blog" },
    { key: "toolbox", href: "/toolbox" },
    { key: "heritage", href: "/heritage" },
    { key: "works", href: "/#works", scroll: true },
    { key: "contact", href: "/#contact", scroll: true },
  ] satisfies NavItem[],
} as const;

export type SiteConfig = typeof site;
