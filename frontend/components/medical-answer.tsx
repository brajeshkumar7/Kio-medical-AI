"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen } from "lucide-react";
import { SourceReference } from "@/lib/types";


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
            <a {...props} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
          table: ({ children, ...props }) => (
            <div className="medical-table-wrap"><table {...props}>{children}</table></div>
          ),
          img: ({ alt = "Medical reference", ...props }) => (
            // The model is instructed to use only source-provided image URLs.
            <img {...props} alt={alt} loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {sources.length > 0 && (
        <details className="answer-sources">
          <summary><BookOpen size={14} /> Sources used</summary>
          <ol>
            {sources.map((source) => (
              <li key={`${source.id}-${source.title}-${source.page ?? "source"}`}>
                <span>[{source.id}]</span>
                <span>{source.title}{source.page ? `, page ${source.page}` : ""}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
