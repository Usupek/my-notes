"use client";

export function DownloadPdfButton({ title }: { title: string }) {
  function download() {
    // The browser uses document.title as the default PDF filename.
    const previous = document.title;
    document.title = title;
    window.addEventListener("afterprint", () => { document.title = previous; }, { once: true });
    window.print();
  }

  return (
    <button type="button" className="rss-button" onClick={download}>
      Download PDF
    </button>
  );
}
