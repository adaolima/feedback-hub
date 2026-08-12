"use client";

import { useState } from "react";
import {
  EmbedFramework,
  buildEmbedSnippet,
  buildReactSnippet,
  buildVueSnippet,
  buildAngularSnippet,
} from "@/lib/widgetDefaults";

const TABS: Array<{ key: EmbedFramework; label: string }> = [
  { key: "vanilla", label: "Vanilla JS" },
  { key: "react", label: "React" },
  { key: "vue", label: "Vue" },
  { key: "angular", label: "Angular" },
];

/** Framework-tabbed embed instructions, shared by the Widgets page's embed modal and the onboarding wizard. */
export function EmbedSnippet({ publicKey, widgetId }: { publicKey: string; widgetId: string }) {
  const [framework, setFramework] = useState<EmbedFramework>("vanilla");

  const snippet = {
    vanilla: buildEmbedSnippet,
    react: buildReactSnippet,
    vue: buildVueSnippet,
    angular: buildAngularSnippet,
  }[framework](publicKey, widgetId);

  return (
    <div className="stack" style={{ gap: 8 }}>
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
      <textarea className="input" rows={13} readOnly value={snippet} />
    </div>
  );
}
