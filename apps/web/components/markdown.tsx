import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; assetBaseUrl?: string };

export function Markdown({ content, assetBaseUrl }: Props) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url, key) => {
          if (key === "src" && assetBaseUrl && url.startsWith("./images/")) {
            const filename = url.slice("./images/".length);
            if (/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(filename)) {
              return `${assetBaseUrl}/${filename}`;
            }
            return "";
          }
          return defaultUrlTransform(url);
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
