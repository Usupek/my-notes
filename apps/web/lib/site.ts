/** Public base URL of the site (no trailing slash). Prefers SITE_URL, falls back to proxy headers. */
export function siteUrl(headers: Headers) {
  const configured = process.env.SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
