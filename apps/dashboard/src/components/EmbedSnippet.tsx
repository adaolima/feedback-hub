"use client";

import { useMemo, useState } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github.css";
import {
  EmbedFramework,
  buildEmbedSnippet,
  buildReactSnippet,
  buildVueSnippet,
  buildAngularSnippet,
} from "@/lib/widgetDefaults";

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("typescript", typescript);

const TABS: Array<{ key: EmbedFramework; label: string; language: string }> = [
  { key: "vanilla", label: "Vanilla JS", language: "xml" },
  { key: "react", label: "React", language: "typescript" },
  { key: "vue", label: "Vue", language: "typescript" },
  { key: "angular", label: "Angular", language: "typescript" },
];

const BUILDERS: Record<EmbedFramework, (publicKey: string, widgetId: string) => string> = {
  vanilla: buildEmbedSnippet,
  react: buildReactSnippet,
  vue: buildVueSnippet,
  angular: buildAngularSnippet,
};

/** Framework-tabbed, syntax-highlighted embed instructions, shared by the Widgets page's embed modal and the onboarding wizard. */
export function EmbedSnippet({ publicKey, widgetId }: { publicKey: string; widgetId: string }) {
  const [framework, setFramework] = useState<EmbedFramework>("vanilla");
  const [copied, setCopied] = useState(false);

  const tab = TABS.find((t) => t.key === framework)!;
  const code = BUILDERS[framework](publicKey, widgetId);
  const highlighted = useMemo(() => hljs.highlight(code, { language: tab.language }).value, [code, tab.language]);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="between">
        <div className="row" style={{ gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn${framework === t.key ? " btn-primary" : ""}`}
              onClick={() => setFramework(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="code-snippet">
        <code className={`hljs language-${tab.language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
