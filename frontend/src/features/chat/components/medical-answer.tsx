"use client";

import { SourceReference } from "@/features/chat/types";
import { BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MedicalAnswer({
  content,
  sources = [],
}: {
  content: string;
  sources?: SourceReference[];
}) {
  return (
    <div className="medical-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className="medical-table-wrap">
              <table {...props}>{children}</table>
            </div>
          ),
          img: ({ alt = "Medical reference", ...props }) => (
            // Source URLs have no known dimensions or fixed host; preserve native Markdown image rendering.
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} alt={alt} loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {sources.length > 0 && (
        <details className="answer-sources">
          <summary>
            <BookOpen size={14} /> Sources used
          </summary>
          <ol>
            {sources.map((source) => (
              <li
                key={`${source.id}-${source.title}-${source.page ?? "source"}`}
              >
                <span>[{source.id}]</span>
                <span>
                  {source.title}
                  {source.page ? `, page ${source.page}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
