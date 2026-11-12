import type { Metadata } from "next";
import Link from "next/link";
import { RssButton } from "@/components/rss-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usupek's Notes",
  description: "Random thing(s) that I want to yap about.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/"><span>/</span>home</Link>
        </header>
        <main>{children}</main>
        <footer>
          <span>@Usupek 2026</span>
          <RssButton />
        </footer>
      </body>
    </html>
  );
}
