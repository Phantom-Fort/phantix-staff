import React, { useMemo } from "react";
import { marked, type Tokens } from "marked";

// Full GFM markdown for the AGI contributor guide (headings, tables, fenced
// architecture diagrams). Input is trusted static content bundled at build time.

marked.setOptions({ gfm: true, breaks: false });

const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }: Tokens.Link) => {
  const t = title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : "";
  const h = String(href || "#").replace(/"/g, "&quot;");
  const external = /^https?:\/\//i.test(h);
  const rel = external ? ' target="_blank" rel="noreferrer"' : "";
  return `<a href="${h}"${t}${rel}>${text}</a>`;
};

renderer.code = ({ text, lang }: Tokens.Code) => {
  const escaped = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const langAttr = lang ? ` data-lang="${String(lang).replace(/"/g, "")}"` : "";
  return `<pre class="guide-pre"${langAttr}><code>${escaped}</code></pre>`;
};

renderer.codespan = ({ text }: Tokens.Codespan) =>
  `<code class="guide-code">${text}</code>`;

marked.use({ renderer });

export function ContributorGuideView({ source }: { source: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(source, { async: false }) as string;
    } catch {
      return `<p class="text-red-300">Failed to render guide.</p>`;
    }
  }, [source]);

  return (
    <div
      className={[
        "contributor-guide max-w-none break-words text-[13px] leading-6 text-slate-300",
        // Headings — ### / ## / # must render as real headings, not raw text
        "[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:first:mt-0 [&_h1]:break-words",
        "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-phantix-700/40 [&_h2]:pb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:first:mt-0 [&_h2]:break-words",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gold-200 [&_h3]:break-words",
        "[&_h4]:mt-5 [&_h4]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-100 [&_h4]:break-words",
        "[&_h5]:mt-4 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:text-slate-200",
        "[&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:uppercase [&_h6]:tracking-wider [&_h6]:text-slate-400",
        // Body
        "[&_p]:mt-2 [&_p]:break-words",
        "[&_strong]:font-semibold [&_strong]:text-slate-100",
        "[&_em]:italic",
        "[&_a]:text-gold-300 [&_a]:underline [&_a]:decoration-gold-400/40 [&_a]:break-all hover:[&_a]:text-gold-200",
        // Lists
        "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:break-words [&_li]:marker:text-gold-400/70",
        // Tables
        "[&_table]:mt-3 [&_table]:mb-4 [&_table]:w-full [&_table]:min-w-[480px] [&_table]:border-collapse [&_table]:text-left [&_table]:text-[12px] [&_table]:leading-5",
        "[&_thead]:border-b [&_thead]:border-phantix-700/40 [&_thead]:bg-phantix-900/60",
        "[&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-slate-200 [&_th]:break-words",
        "[&_td]:border-b [&_td]:border-phantix-700/30 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-400 [&_td]:break-words",
        "[&_table]:block [&_table]:overflow-x-auto [&_table]:rounded-xl [&_table]:border [&_table]:border-phantix-700/40",
        // Code + architecture diagrams (box-drawing preserved via pre + monospace)
        "[&_.guide-pre]:mt-3 [&_.guide-pre]:mb-4 [&_.guide-pre]:max-w-full [&_.guide-pre]:overflow-x-auto [&_.guide-pre]:rounded-xl [&_.guide-pre]:border [&_.guide-pre]:border-phantix-700/40 [&_.guide-pre]:bg-phantix-950/90 [&_.guide-pre]:p-4",
        "[&_.guide-pre]:font-mono [&_.guide-pre]:text-[11px] [&_.guide-pre]:leading-[1.45] [&_.guide-pre]:text-slate-300 [&_.guide-pre]:whitespace-pre",
        "[&_.guide-pre_code]:bg-transparent [&_.guide-pre_code]:p-0 [&_.guide-pre_code]:text-inherit",
        "[&_.guide-code]:rounded [&_.guide-code]:bg-phantix-950/80 [&_.guide-code]:px-1 [&_.guide-code]:py-0.5 [&_.guide-code]:font-mono [&_.guide-code]:text-[11px] [&_.guide-code]:text-gold-200/90",
        // Quote / hr
        "[&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-gold-400/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-400",
        "[&_hr]:my-6 [&_hr]:border-phantix-700/40",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default ContributorGuideView;
