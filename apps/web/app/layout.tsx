import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usupek's Notes",
  description: "Catatan singkat tentang hal yang sedang dipelajari.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/"><span>~/</span>Home</Link>
          <nav>
            <Link href="/">Archive</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>Ditulis perlahan, disimpan rafi.</footer>
      </body>
    </html>
  );
}
