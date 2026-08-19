import { afterEach, describe, expect, it, vi } from "vitest";
import { mountWidget } from "../src/render";
import { Widget, SurveyQuestion } from "../src/types";

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.innerHTML = "";
});

function baseWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: "w1",
    name: "Test widget",
    type: "rating",
    config: {},
    ...overrides,
  };
}

describe("mountWidget - rating", () => {
  it("renders one star per point in the configured range and submits the clicked rating", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    const widget = baseWidget({ config: { question: { min: 1, max: 5 } } });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    const stars = shadow.querySelectorAll<HTMLButtonElement>(".fh-star-btn");
    expect(stars).toHaveLength(5);

    stars[2].click(); // 3rd star = rating 3
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, answers: [{ type: "rating", value: 3 }] });
    expect(shadow.querySelector(".fh-thanks")?.textContent).toBe("Thanks for your feedback!");
  });
});

describe("mountWidget - choice / multiple_choice", () => {
  const options = [
    { id: "o1", label: "Blue", value: "blue" },
    { id: "o2", label: "Green", value: "green" },
  ];

  it("submits a single selected value for a choice question (radio inputs)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.body.appendChild(document.createElement("div"));
    const widget = baseWidget({
      type: "choice",
      config: { question: { question: "Favourite colour?", options, multiple: false } },
    });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    const inputs = shadow.querySelectorAll<HTMLInputElement>('input[name="fh-choice"]');
    expect(inputs[0].type).toBe("radio");

    inputs[1].click();
    shadow.querySelector<HTMLButtonElement>(".fh-btn-primary")!.click();
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({ answers: [{ type: "choice", value: ["green"] }] });
  });

  it("submits every checked value for a multiple_choice question (checkbox inputs)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.body.appendChild(document.createElement("div"));
    const widget = baseWidget({
      type: "multiple_choice",
      config: { question: { question: "Which apply?", options, multiple: true } },
    });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    const inputs = shadow.querySelectorAll<HTMLInputElement>('input[name="fh-choice"]');
    expect(inputs[0].type).toBe("checkbox");

    inputs[0].click();
    inputs[1].click();
    shadow.querySelector<HTMLButtonElement>(".fh-btn-primary")!.click();
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({
      answers: [{ type: "multiple_choice", value: ["blue", "green"] }],
    });
  });
});

describe("mountWidget - nps follow-up", () => {
  it("shows an optional comment step before submitting when followUpQuestion is configured", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    const widget = baseWidget({
      type: "nps",
      config: { question: { followUpQuestion: "What's the main reason for your score?" } },
    });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    const scoreButtons = shadow.querySelectorAll<HTMLButtonElement>('[aria-label^="Score "]');
    expect(scoreButtons).toHaveLength(11); // 0..10

    scoreButtons[8].click(); // score 8
    expect(onSubmit).not.toHaveBeenCalled();

    const followUpTitle = shadow.querySelector("h3")?.textContent;
    expect(followUpTitle).toBe("What's the main reason for your score?");

    const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Great support";
    shadow.querySelector<HTMLButtonElement>(".fh-btn-primary")!.click();
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({
      npsScore: 8,
      feedbackText: "Great support",
      answers: [
        { type: "nps", value: 8 },
        { type: "text", value: "Great support" },
      ],
    });
  });

  it("submits immediately with no follow-up step when followUpQuestion is not configured", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    const widget = baseWidget({ type: "nps", config: { question: {} } });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    shadow.querySelectorAll<HTMLButtonElement>('[aria-label^="Score "]')[10].click(); // score 10
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({ npsScore: 10, answers: [{ type: "nps", value: 10 }] });
  });
});

describe("mountWidget - survey conditional logic", () => {
  function question(overrides: Partial<SurveyQuestion>): SurveyQuestion {
    return {
      id: "q1",
      type: "rating",
      title: "Question",
      required: false,
      position: 0,
      config: {},
      options: [],
      ...overrides,
    };
  }

  it("skips a question whose conditional_logic rule fails against the prior answer", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    const questions: SurveyQuestion[] = [
      question({ id: "q1", type: "rating", title: "Rate us", config: { min: 1, max: 5 }, position: 0 }),
      question({
        id: "q2",
        type: "text",
        title: "Why the low score?",
        position: 1,
        conditional_logic: { all: [{ questionId: "q1", operator: "lte", value: 3 }] },
      }),
    ];
    const widget = baseWidget({ type: "survey", survey: { id: "s1", name: "Survey", questions } });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    // Answer q1 with a high rating (5) so q2's "lte 3" condition fails.
    shadow.querySelectorAll<HTMLButtonElement>(".fh-star-btn")[4].click();
    await flush();

    // q2 should have been skipped entirely - straight to submit with only q1's answer.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      answers: [{ type: "rating", value: 5, questionId: "q1" }],
    });
  });

  it("shows a question whose conditional_logic rule passes and includes its answer", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    const questions: SurveyQuestion[] = [
      question({ id: "q1", type: "rating", title: "Rate us", config: { min: 1, max: 5 }, position: 0 }),
      question({
        id: "q2",
        type: "text",
        title: "Why the low score?",
        position: 1,
        conditional_logic: { all: [{ questionId: "q1", operator: "lte", value: 3 }] },
      }),
    ];
    const widget = baseWidget({ type: "survey", survey: { id: "s1", name: "Survey", questions } });

    const mounted = mountWidget(widget, container, onSubmit);
    const shadow = mounted.host.shadowRoot!;
    // Answer q1 with a low rating (2) so q2's "lte 3" condition passes.
    shadow.querySelectorAll<HTMLButtonElement>(".fh-star-btn")[1].click();
    await flush();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(shadow.querySelector("h3")?.textContent).toBe("Why the low score?");

    const input = shadow.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = "Slow delivery";
    shadow.querySelector<HTMLButtonElement>(".fh-btn-primary")!.click();
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({
      answers: [
        { type: "rating", value: 2, questionId: "q1" },
        { type: "text", value: "Slow delivery", questionId: "q2" },
      ],
    });
  });
});
