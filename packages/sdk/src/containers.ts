const POSITION_STYLES: Record<string, string> = {
  "bottom-right": "position:fixed;bottom:20px;right:20px;z-index:2147483000;",
  "bottom-left": "position:fixed;bottom:20px;left:20px;z-index:2147483000;",
  "top-right": "position:fixed;top:20px;right:20px;z-index:2147483000;",
  "top-left": "position:fixed;top:20px;left:20px;z-index:2147483000;",
  center: "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483000;",
};

/** Creates (or reuses) a fixed-position container appropriate for the widget's display mode. */
export function getOrCreateFloatingContainer(mode: string, position = "bottom-right"): HTMLElement {
  const id = `fh-container-${mode}`;
  let el = document.getElementById(id);
  if (el) return el;

  el = document.createElement("div");
  el.id = id;

  if (mode === "modal") {
    el.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.4);z-index:2147483000;";
  } else if (mode === "bottom_bar") {
    el.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;padding:12px;z-index:2147483000;";
  } else {
    el.style.cssText = POSITION_STYLES[position] ?? POSITION_STYLES["bottom-right"];
  }

  document.body.appendChild(el);
  return el;
}

export function getInlineContainer(selector = "#feedback-widget"): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

/** Looks up an inline container by widget id, then by widget name (data-feedback-widget="Name"), then the generic fallback. */
export function findInlineContainer(widgetId: string, widgetName: string): HTMLElement | null {
  return (
    document.getElementById(`feedback-widget-${widgetId}`) ??
    document.querySelector<HTMLElement>(`[data-feedback-widget="${CSS.escape(widgetName)}"]`) ??
    document.getElementById("feedback-widget")
  );
}

export function createFloatingButton(onClick: () => void, position = "bottom-right"): HTMLElement {
  const existing = document.getElementById("fh-floating-button");
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.id = "fh-floating-button";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open feedback");
  btn.textContent = "\u{1F4AC} Feedback";
  btn.style.cssText = `${POSITION_STYLES[position] ?? POSITION_STYLES["bottom-right"]}
    background:#4f46e5;color:#fff;border:none;border-radius:999px;padding:12px 18px;
    font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.2);font-family:system-ui,sans-serif;`;
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  return btn;
}
