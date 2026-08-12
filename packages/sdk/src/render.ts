import { Widget, SurveyQuestion } from "./types";

const PRESETS: Record<string, Record<string, string>> = {
  minimal: { "--fh-primary": "#111827", "--fh-bg": "#ffffff", "--fh-text": "#111827", "--fh-radius": "6px" },
  modern: { "--fh-primary": "#4f46e5", "--fh-bg": "#ffffff", "--fh-text": "#1f2937", "--fh-radius": "12px" },
  rounded: { "--fh-primary": "#059669", "--fh-bg": "#ffffff", "--fh-text": "#111827", "--fh-radius": "24px" },
  corporate: { "--fh-primary": "#1d4ed8", "--fh-bg": "#f8fafc", "--fh-text": "#0f172a", "--fh-radius": "4px" },
  dark: { "--fh-primary": "#818cf8", "--fh-bg": "#111827", "--fh-text": "#f9fafb", "--fh-radius": "10px" },
  glass: { "--fh-primary": "#38bdf8", "--fh-bg": "rgba(255,255,255,0.7)", "--fh-text": "#0f172a", "--fh-radius": "16px" },
};

const BASE_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: var(--fh-font, system-ui, -apple-system, sans-serif); }
  .fh-widget {
    background: var(--fh-bg, #fff);
    color: var(--fh-text, #111);
    border-radius: var(--fh-radius, 10px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    padding: 20px;
    font-size: var(--fh-font-size, 14px);
    max-width: 380px;
  }
  .fh-widget h3 { margin: 0 0 12px; font-size: 1.05em; font-weight: 600; }
  .fh-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .fh-btn {
    cursor: pointer;
    border: 1px solid var(--fh-primary, #4f46e5);
    background: transparent;
    color: var(--fh-primary, #4f46e5);
    border-radius: calc(var(--fh-radius, 10px) / 2);
    padding: 8px 14px;
    font-size: 1em;
    line-height: 1;
  }
  .fh-btn:hover, .fh-btn:focus-visible { background: var(--fh-primary, #4f46e5); color: #fff; outline: none; }
  .fh-btn.fh-selected { background: var(--fh-primary, #4f46e5); color: #fff; }
  .fh-btn-primary { background: var(--fh-primary, #4f46e5); color: #fff; border: none; }
  .fh-emoji-btn { font-size: 1.8em; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 8px; }
  .fh-emoji-btn:hover, .fh-emoji-btn:focus-visible { background: rgba(0,0,0,0.06); outline: none; }
  .fh-stars { gap: 2px; }
  .fh-star-btn { font-size: 1.8em; line-height: 1; background: none; border: none; cursor: pointer; padding: 2px 4px; color: var(--fh-primary, #4f46e5); }
  .fh-star-btn:focus-visible { outline: 2px solid var(--fh-primary, #4f46e5); outline-offset: 2px; border-radius: 4px; }
  textarea, input[type="text"] {
    width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #d1d5db;
    font-size: 1em; color: inherit; background: #fff;
  }
  .fh-choice-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .fh-close { position: absolute; top: 8px; right: 10px; background: none; border: none; font-size: 1.1em; cursor: pointer; color: inherit; }
  .fh-container { position: relative; }
  .fh-thanks { text-align: center; padding: 8px 0; }
  @media (prefers-reduced-motion: no-preference) {
    .fh-widget { transition: transform 0.15s ease, opacity 0.15s ease; }
  }
`;

function appearanceVars(appearance: Record<string, any> = {}): string {
  const preset = PRESETS[appearance.preset] ?? PRESETS.modern;
  const vars: Record<string, string> = { ...preset };
  if (appearance.primaryColor) vars["--fh-primary"] = appearance.primaryColor;
  if (appearance.backgroundColor) vars["--fh-bg"] = appearance.backgroundColor;
  if (appearance.textColor) vars["--fh-text"] = appearance.textColor;
  if (appearance.borderRadius !== undefined) vars["--fh-radius"] = `${appearance.borderRadius}px`;
  if (appearance.font) vars["--fh-font"] = appearance.font;
  if (appearance.fontSize) vars["--fh-font-size"] = `${appearance.fontSize}px`;
  Object.assign(vars, appearance.customCss ?? {});
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

export type SubmitPayload = {
  rating?: number;
  npsScore?: number;
  feedbackText?: string;
  answers?: Array<{ questionId?: string; type: string; value: unknown }>;
};

/** Renders a single question type into a container element. Calls onSubmit with the collected answer. */
function renderQuestionBody(
  root: HTMLElement,
  type: string,
  config: Record<string, any>,
  onSubmit: (payload: SubmitPayload) => void
) {
  switch (type) {
    case "rating": {
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      const title = document.createElement("h3");
      title.textContent = config.question ?? "How would you rate your experience?";
      root.appendChild(title);
      const row = document.createElement("div");
      row.className = "fh-row fh-stars";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Rating");
      const stars: HTMLButtonElement[] = [];
      const paint = (filledCount: number) => {
        stars.forEach((star, idx) => {
          star.textContent = idx < filledCount ? "★" : "☆"; // ★ / ☆
        });
      };
      for (let i = min; i <= max; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fh-star-btn";
        btn.textContent = "☆";
        btn.setAttribute("aria-label", `Rate ${i} out of ${max}`);
        btn.addEventListener("mouseenter", () => paint(i - min + 1));
        btn.addEventListener("mouseleave", () => paint(0));
        btn.addEventListener("click", () => onSubmit({ rating: i, answers: [{ type: "rating", value: i }] }));
        stars.push(btn);
        row.appendChild(btn);
      }
      root.appendChild(row);
      if (config.minLabel || config.maxLabel) {
        const labels = document.createElement("div");
        labels.style.cssText = "display:flex;justify-content:space-between;font-size:0.85em;opacity:0.7;";
        labels.innerHTML = `<span>${config.minLabel ?? ""}</span><span>${config.maxLabel ?? ""}</span>`;
        root.appendChild(labels);
      }
      break;
    }
    case "nps": {
      const title = document.createElement("h3");
      title.textContent = "How likely are you to recommend us to a friend or colleague?";
      root.appendChild(title);
      const row = document.createElement("div");
      row.className = "fh-row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Net Promoter Score");
      for (let i = 0; i <= 10; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fh-btn";
        btn.textContent = String(i);
        btn.setAttribute("aria-label", `Score ${i} out of 10`);
        btn.addEventListener("click", () => onSubmit({ npsScore: i, answers: [{ type: "nps", value: i }] }));
        row.appendChild(btn);
      }
      root.appendChild(row);
      break;
    }
    case "thumbs": {
      const title = document.createElement("h3");
      title.textContent = config.question ?? "Was this helpful?";
      root.appendChild(title);
      const row = document.createElement("div");
      row.className = "fh-row";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "fh-btn";
      up.textContent = "\u{1F44D}";
      up.setAttribute("aria-label", "Yes, this was helpful");
      up.addEventListener("click", () => onSubmit({ rating: 1, answers: [{ type: "thumbs", value: "up" }] }));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "fh-btn";
      down.textContent = "\u{1F44E}";
      down.setAttribute("aria-label", "No, this was not helpful");
      down.addEventListener("click", () => onSubmit({ rating: 0, answers: [{ type: "thumbs", value: "down" }] }));
      row.appendChild(up);
      row.appendChild(down);
      root.appendChild(row);
      break;
    }
    case "emoji": {
      const title = document.createElement("h3");
      title.textContent = config.question ?? "How was your experience?";
      root.appendChild(title);
      const row = document.createElement("div");
      row.className = "fh-row";
      const emojis: string[] = config.emojis ?? ["\u{1F621}", "\u{1F61E}", "\u{1F610}", "\u{1F642}", "\u{1F60D}"];
      emojis.forEach((emoji, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fh-emoji-btn";
        btn.textContent = emoji;
        btn.setAttribute("aria-label", `Reaction ${index + 1} of ${emojis.length}`);
        btn.addEventListener("click", () =>
          onSubmit({ rating: index + 1, answers: [{ type: "emoji", value: emoji }] })
        );
        row.appendChild(btn);
      });
      root.appendChild(row);
      break;
    }
    case "text": {
      const title = document.createElement("h3");
      title.textContent = config.question ?? "What do you think?";
      root.appendChild(title);
      const input = config.long ? document.createElement("textarea") : document.createElement("input");
      if (!config.long) (input as HTMLInputElement).type = "text";
      else (input as HTMLTextAreaElement).rows = 4;
      if (config.maxLength) input.setAttribute("maxlength", String(config.maxLength));
      input.setAttribute("aria-label", config.question ?? "Feedback");
      root.appendChild(input);
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "fh-btn fh-btn-primary";
      submit.style.marginTop = "10px";
      submit.textContent = "Submit";
      submit.addEventListener("click", () => {
        const value = (input as HTMLInputElement).value.trim();
        onSubmit({ feedbackText: value, answers: [{ type: "text", value }] });
      });
      root.appendChild(submit);
      break;
    }
    case "choice":
    case "multiple_choice": {
      const title = document.createElement("h3");
      title.textContent = config.question ?? "Please choose an option";
      root.appendChild(title);
      const options: Array<{ id: string; label: string; value: string }> = config.options ?? [];
      const selected = new Set<string>();
      const inputType = config.multiple ? "checkbox" : "radio";
      options.forEach((opt) => {
        const wrapper = document.createElement("label");
        wrapper.className = "fh-choice-row";
        const input = document.createElement("input");
        input.type = inputType;
        input.name = "fh-choice";
        input.value = opt.value;
        input.addEventListener("change", () => {
          if (config.multiple) {
            input.checked ? selected.add(opt.value) : selected.delete(opt.value);
          } else {
            selected.clear();
            selected.add(opt.value);
          }
        });
        const span = document.createElement("span");
        span.textContent = opt.label;
        wrapper.appendChild(input);
        wrapper.appendChild(span);
        root.appendChild(wrapper);
      });
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "fh-btn fh-btn-primary";
      submit.style.marginTop = "10px";
      submit.textContent = "Submit";
      submit.addEventListener("click", () => {
        const value = Array.from(selected);
        onSubmit({ answers: [{ type: config.multiple ? "multiple_choice" : "choice", value }] });
      });
      root.appendChild(submit);
      break;
    }
    default: {
      const title = document.createElement("h3");
      title.textContent = "Feedback";
      root.appendChild(title);
    }
  }
}

/** Renders a thank-you state after successful submission. */
function renderThanks(root: HTMLElement) {
  root.innerHTML = "";
  const thanks = document.createElement("div");
  thanks.className = "fh-thanks";
  thanks.setAttribute("role", "status");
  thanks.textContent = "Thanks for your feedback!";
  root.appendChild(thanks);
}

export interface MountedWidget {
  host: HTMLElement;
  destroy: () => void;
}

export function mountWidget(
  widget: Widget,
  container: HTMLElement,
  onSubmit: (payload: SubmitPayload) => Promise<void>,
  onClose?: () => void
): MountedWidget {
  const host = document.createElement("div");
  host.setAttribute("data-feedbackhub-widget", widget.id);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = BASE_CSS;
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.className = "fh-widget fh-container";
  wrapper.style.cssText = appearanceVars(widget.config?.appearance);
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", widget.name || "Feedback");
  shadow.appendChild(wrapper);

  if (onClose) {
    const closeBtn = document.createElement("button");
    closeBtn.className = "fh-close";
    closeBtn.setAttribute("aria-label", "Close feedback widget");
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", onClose);
    wrapper.appendChild(closeBtn);
  }

  const body = document.createElement("div");
  wrapper.appendChild(body);

  if (widget.type === "survey" && widget.survey) {
    renderSurvey(body, widget.survey.questions, onSubmit);
  } else {
    renderQuestionBody(body, widget.type, widget.config?.question ?? {}, async (payload) => {
      await onSubmit(payload);
      renderThanks(wrapper);
    });
  }

  container.appendChild(host);

  return {
    host,
    destroy: () => host.remove(),
  };
}

function evaluateCondition(logic: Record<string, any> | undefined, answers: Record<string, unknown>): boolean {
  if (!logic || !logic.all || logic.all.length === 0) return true;
  return logic.all.every((rule: any) => {
    const value = answers[rule.questionId];
    if (value === undefined) return false;
    switch (rule.operator) {
      case "lte":
        return Number(value) <= Number(rule.value);
      case "gte":
        return Number(value) >= Number(rule.value);
      case "lt":
        return Number(value) < Number(rule.value);
      case "gt":
        return Number(value) > Number(rule.value);
      case "eq":
        return value === rule.value;
      case "neq":
        return value !== rule.value;
      default:
        return true;
    }
  });
}

function renderSurvey(
  container: HTMLElement,
  questions: SurveyQuestion[],
  onSubmit: (payload: SubmitPayload) => Promise<void>
) {
  const answers: Record<string, unknown> = {};
  const collectedAnswers: NonNullable<SubmitPayload["answers"]> = [];
  let index = 0;

  function showNext() {
    while (index < questions.length && !evaluateCondition(questions[index].conditional_logic, answers)) {
      index++;
    }
    container.innerHTML = "";
    if (index >= questions.length) {
      onSubmit({ answers: collectedAnswers }).then(() => renderThanks(container));
      return;
    }
    const question = questions[index];
    renderQuestionBody(container, question.type, question.config ?? {}, (payload) => {
      const value =
        payload.rating ?? payload.npsScore ?? payload.feedbackText ?? payload.answers?.[0]?.value;
      answers[question.id] = value;
      if (payload.answers) collectedAnswers.push(...payload.answers.map((a) => ({ ...a, questionId: question.id })));
      index++;
      showNext();
    });
  }

  showNext();
}
