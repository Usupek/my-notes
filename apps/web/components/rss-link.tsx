import Link from "next/link";

export function RssIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="2.5" cy="13.5" r="2.5" />
      <path d="M0 5.5v2.6a7.9 7.9 0 0 1 7.9 7.9h2.6A10.5 10.5 0 0 0 0 5.5Z" />
      <path d="M0 0v2.6A13.4 13.4 0 0 1 13.4 16H16A16 16 0 0 0 0 0Z" />
    </svg>
  );
}

export function RssButton() {
  return (
    <Link className="rss-button" href="/subscribe" title="Subscribe via RSS">
      <RssIcon /> Subscribe RSS
    </Link>
  );
}
