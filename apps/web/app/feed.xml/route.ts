import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { serverApi } from "@/lib/api";
import { rssEnabled, siteUrl } from "@/lib/site";
import type { Note } from "@/lib/types";

export const dynamic = "force-dynamic";

const FEED_TITLE = "Usupek's Notes";
const FEED_DESCRIPTION = "Random thing(s) that I want to yap about.";
const FEED_SIZE = 20;
const CACHE_SECONDS = 300;
const IMAGE_FILENAME = /^[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/i;

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: string) {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function absolute(base: string, url: string) {
  return url.startsWith("/") ? `${base}${url}` : url;
}

// Mirrors the image handling in components/markdown.tsx, but emits absolute URLs for feed readers.
function rewriteImages(site: string, assetBaseUrl?: string) {
  return () => (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName === "img" && node.properties) {
        const src = String(node.properties.src ?? "");
        if (src.startsWith("./images/")) {
          const filename = src.slice("./images/".length);
          node.properties.src = assetBaseUrl && IMAGE_FILENAME.test(filename)
            ? absolute(site, `${assetBaseUrl}/${filename}`)
            : "";
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

async function renderHtml(markdown: string, site: string, assetBaseUrl?: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype) // raw HTML is dropped by default, matching skipHtml in the web renderer
    .use(rewriteImages(site, assetBaseUrl))
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(serverApi(path), { next: { revalidate: CACHE_SECONDS } });
  if (!response.ok) return null;
  return ((await response.json()) as { data: T }).data;
}

export async function GET(request: Request) {
  if (!rssEnabled()) return new Response("Not found", { status: 404 });
  const site = siteUrl(request.headers);
  const list = await fetchJson<Note[]>("/notes?limit=50");
  if (!list) return new Response("Feed unavailable", { status: 502 });

  const latest = list
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, FEED_SIZE);
  const notes = (await Promise.all(latest.map((note) => fetchJson<Note>(`/notes/${note.id}`))))
    .filter((note): note is Note => note !== null);

  const items = await Promise.all(notes.map(async (note) => {
    const link = `${site}/notes/${note.id}`;
    const html = await renderHtml(note.content_markdown ?? "", site, note.asset_base_url);
    return [
      "    <item>",
      `      <title>${escapeXml(note.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${new Date(note.created_at).toUTCString()}</pubDate>`,
      ...note.tags.map((tag) => `      <category>${escapeXml(tag.name)}</category>`),
      `      <description>${cdata(html)}</description>`,
      "    </item>",
    ].join("\n");
  }));

  const lastBuild = notes.reduce((latestDate, note) => Math.max(latestDate, Date.parse(note.updated_at)), 0);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(site)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${site}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date(lastBuild || Date.now()).toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
}
