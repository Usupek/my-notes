/** RSS feed is on unless RSS_ENABLED is set to false/0/off/no. */
export function rssEnabled() {
  const value = process.env.RSS_ENABLED?.trim().toLowerCase();
  return !value || !["false", "0", "off", "no"].includes(value);
}

/** Public base URL of the site (no trailing slash). Prefers SITE_URL, falls back to proxy headers. */
export function siteUrl(headers: Headers) {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
