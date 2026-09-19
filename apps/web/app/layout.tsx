import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usupek's Notes",
  description: "Random thing(s) that I want to yap about.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/"><span>~/</span>Home</Link>
        </header>
        <main>{children}</main>
        <footer>@Usupek 2026</footer>
      </body>
    </html>
  );
}
