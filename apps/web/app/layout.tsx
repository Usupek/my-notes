import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Catatan", template: "%s · Catatan" },
  description: "Catatan singkat tentang hal yang sedang dipelajari.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">catatan<span>.</span></Link>
          <nav>
            <Link href="/">Arsip</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>Ditulis perlahan, disimpan rapi.</footer>
      </body>
    </html>
  );
}
