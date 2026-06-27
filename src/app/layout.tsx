import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { HomeModeProvider } from "@/components/providers/HomeModeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Background } from "@/components/Background";
import { site } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-serif",
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: {
    default: `${site.title} · ${site.name}`,
    template: `%s · ${site.title}`,
  },
  description:
    "VIRONGX — 曹淋锦荣的个人站，分享技术、作品与思考。Developer & maker portfolio.",
  metadataBase: new URL(site.url),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <HomeModeProvider>
              <Background />
              <Navbar />
              <main className="flex-1 pt-28">{children}</main>
              <Footer />
            </HomeModeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
