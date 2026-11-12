import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyField } from "@/components/copy-button";
import { RssIcon } from "@/components/rss-link";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Subscribe · Usupek's Notes" };

const PLATFORMS: { name: string; apps: { name: string; href: string }[] }[] = [
  { name: "Android", apps: [{ name: "Feeder", href: "https://f-droid.org/packages/com.nononsenseapps.feeder/" }, { name: "Feedly", href: "https://feedly.com/" }] },
  { name: "iOS", apps: [{ name: "NetNewsWire", href: "https://netnewswire.com/" }, { name: "Reeder", href: "https://reederapp.com/" }] },
  { name: "macOS", apps: [{ name: "NetNewsWire", href: "https://netnewswire.com/" }, { name: "Reeder", href: "https://reederapp.com/" }] },
  { name: "Windows", apps: [{ name: "Fluent Reader", href: "https://hyliu.me/fluent-reader/" }, { name: "Feedly", href: "https://feedly.com/" }] },
  { name: "Linux", apps: [{ name: "NewsFlash", href: "https://flathub.org/apps/io.gitlab.news_flash.NewsFlash" }, { name: "Newsboat", href: "https://newsboat.org/" }] },
  { name: "Browser", apps: [{ name: "Feedly", href: "https://feedly.com/" }, { name: "Inoreader", href: "https://www.inoreader.com/" }] },
];

export default async function SubscribePage() {
  const feedUrl = `${siteUrl(await headers())}/feed.xml`;

  return (
    <article className="article-shell subscribe-page">
      <Link className="back-link" href="/">← Back to Archive</Link>
      <header className="article-header">
        <p className="eyebrow"><RssIcon /> RSS Feed</p>
        <h1>Subscribe</h1>
      </header>
      <div className="markdown">
        <p>
          wtf is an RSS? a digital newspaper basically. <br/>
          Grab the URL below, drop it into any RSS reader,
          and new notes show up there.
        </p>
      </div>
      <CopyField value={feedUrl} />
      <div className="markdown platform-list">
        <p>View ts rss on:</p>
        <ul>
          {PLATFORMS.map((platform) => (
            <li key={platform.name}>
              <strong>{platform.name}:</strong>{" "}
              {platform.apps.map((app, index) => (
                <span key={app.name}>
                  {index > 0 && ", "}
                  <a href={app.href} target="_blank" rel="noopener noreferrer">{app.name}</a>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
