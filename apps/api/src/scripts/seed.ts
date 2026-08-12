/**
 * Seeds a fully populated demo organisation so the dashboard looks alive immediately after setup.
 * Safe to re-run: skips creation if the demo user already exists.
 */
import { pool } from "../db";
import { hashPassword } from "../lib/password";

const DEMO_EMAIL = "demo@feedbackhub.dev";
const DEMO_PASSWORD = "password123";
const DEMO_PUBLIC_KEY = "pk_demo_00000000000000000000000000";

async function seed() {
  const existingUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [DEMO_EMAIL]);
  if (existingUser.rowCount && existingUser.rowCount > 0) {
    console.log("Seed data already present. Skipping.");
    await pool.end();
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await pool.query(
    `INSERT INTO users (email, password_hash, name, email_verified_at) VALUES ($1, $2, $3, now()) RETURNING id`,
    [DEMO_EMAIL, passwordHash, "Demo User"]
  );
  const userId = user.rows[0].id;

  const org = await pool.query(
    `INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING id`,
    ["Demo Organisation", "demo"]
  );
  const orgId = org.rows[0].id;

  await pool.query(
    `INSERT INTO organisation_members (organisation_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [orgId, userId]
  );

  const project = await pool.query(
    `INSERT INTO projects (organisation_id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
    [orgId, "Demo Project", "demo-project"]
  );
  const projectId = project.rows[0].id;

  await pool.query(
    `INSERT INTO api_keys (project_id, name, type, key_value, created_by) VALUES ($1, $2, 'public', $3, $4)`,
    [projectId, "Demo Public Key", DEMO_PUBLIC_KEY, userId]
  );

  const ratingWidget = await pool.query(
    `INSERT INTO widgets (project_id, name, type, config, status, published_at)
     VALUES ($1, 'Website Rating', 'rating', $2, 'published', now()) RETURNING id`,
    [
      projectId,
      JSON.stringify({
        displayMode: "inline",
        appearance: { preset: "modern", primaryColor: "#4f46e5" },
        // "always" so the demo site reliably shows every widget on every visit; a real deployment
        // would typically use a frequency cap like "once_per_session" to avoid nagging users.
        targeting: { frequency: "always" },
        question: { type: "rating", min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" },
      }),
    ]
  );

  const npsWidget = await pool.query(
    `INSERT INTO widgets (project_id, name, type, config, status, published_at)
     VALUES ($1, 'NPS Survey', 'nps', $2, 'published', now()) RETURNING id`,
    [
      projectId,
      JSON.stringify({
        displayMode: "floating",
        appearance: { preset: "minimal", primaryColor: "#0ea5e9" },
        // See note on the rating widget above re: "always" vs. a production-appropriate cap.
        // events: opens immediately on a matching track() call, demonstrating event-triggered
        // display — not just the delayed floating button.
        targeting: { delaySeconds: 5, frequency: "always", events: ["checkout_completed"] },
        question: { type: "nps", followUpQuestion: "What could we improve?" },
      }),
    ]
  );

  const thumbsWidget = await pool.query(
    `INSERT INTO widgets (project_id, name, type, config, status, published_at)
     VALUES ($1, 'Was this helpful?', 'thumbs', $2, 'published', now()) RETURNING id`,
    [
      projectId,
      JSON.stringify({
        displayMode: "inline",
        appearance: { preset: "rounded" },
        targeting: { frequency: "always" },
        question: { type: "thumbs", question: "Was this helpful?" },
      }),
    ]
  );

  await pool.query(
    `INSERT INTO widgets (project_id, name, type, config, status, published_at)
     VALUES ($1, 'Emoji Reaction', 'emoji', $2, 'published', now())`,
    [
      projectId,
      JSON.stringify({
        displayMode: "bottom_bar",
        appearance: { preset: "glass" },
        // See note on the rating widget above re: "always" vs. a production-appropriate cap.
        targeting: { frequency: "always" },
        question: {
          type: "emoji",
          question: "How was your experience?",
          emojis: ["😡", "😞", "😐", "🙂", "😍"],
        },
      }),
    ]
  );

  const survey = await pool.query(
    `INSERT INTO surveys (project_id, name, description, status) VALUES ($1, $2, $3, 'published') RETURNING id`,
    [projectId, "Post-Checkout Survey", "Collects feedback right after checkout completes"]
  );
  const surveyId = survey.rows[0].id;

  const q1 = await pool.query(
    `INSERT INTO survey_questions (survey_id, type, title, required, position, config)
     VALUES ($1, 'rating', 'How satisfied are you with this feature?', true, 0, $2) RETURNING id`,
    [surveyId, JSON.stringify({ type: "rating", min: 1, max: 5 })]
  );
  await pool.query(
    `INSERT INTO survey_questions (survey_id, type, title, required, position, config)
     VALUES ($1, 'text', 'What could we improve?', false, 1, $2)`,
    [surveyId, JSON.stringify({ type: "text", long: true, maxLength: 1000, question: "What could we improve?" })]
  );
  await pool.query(
    `INSERT INTO survey_questions (survey_id, type, title, required, position, config, conditional_logic)
     VALUES ($1, 'nps', 'Would you recommend us?', true, 2, $2, $3)`,
    [
      surveyId,
      JSON.stringify({ type: "nps" }),
      JSON.stringify({ all: [{ questionId: q1.rows[0].id, operator: "lte", value: 3 }], action: "show" }),
    ]
  );

  // A survey only becomes reachable by the SDK (and therefore submittable) once it's wrapped in a
  // published widget — /public/config only ever returns widgets, never surveys directly.
  const surveyWidget = await pool.query(
    `INSERT INTO widgets (project_id, name, type, survey_id, config, status, published_at)
     VALUES ($1, 'Post-Checkout Survey', 'survey', $2, $3, 'published', now()) RETURNING id`,
    [
      projectId,
      surveyId,
      JSON.stringify({
        displayMode: "modal",
        appearance: { preset: "corporate", primaryColor: "#1d4ed8" },
        targeting: { frequency: "always" },
      }),
    ]
  );

  const now = Date.now();
  const sampleResponses: Array<[string, number | null, number | null, string | null, string]> = [
    [ratingWidget.rows[0].id, 5, null, "Amazing experience!", "/pricing"],
    [ratingWidget.rows[0].id, 4, null, "Pretty good overall.", "/pricing"],
    [thumbsWidget.rows[0].id, 0, null, "I couldn't find the documentation.", "/docs"],
    [thumbsWidget.rows[0].id, 1, null, null, "/docs"],
    [npsWidget.rows[0].id, null, 9, "Very easy to use.", "/dashboard"],
    [npsWidget.rows[0].id, null, 6, "Onboarding was confusing.", "/dashboard"],
    [npsWidget.rows[0].id, null, 10, null, "/dashboard"],
  ];

  for (const [widgetId, rating, npsScore, feedbackText, pageUrl] of sampleResponses) {
    await pool.query(
      `INSERT INTO responses (project_id, widget_id, anonymous_id, rating, nps_score, feedback_text, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        projectId,
        widgetId,
        `anon_${Math.random().toString(36).slice(2, 10)}`,
        rating,
        npsScore,
        feedbackText,
        JSON.stringify({ pageUrl, deviceType: "desktop", browser: "Chrome", os: "macOS", country: "IE" }),
        new Date(now - Math.random() * 1000 * 60 * 60 * 24 * 14),
      ]
    );
  }

  const surveyResponse = await pool.query(
    `INSERT INTO responses (project_id, widget_id, survey_id, anonymous_id, rating, feedback_text, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      projectId,
      surveyWidget.rows[0].id,
      surveyId,
      `anon_${Math.random().toString(36).slice(2, 10)}`,
      2,
      "Checkout felt slower than expected.",
      JSON.stringify({ pageUrl: "/checkout/success", deviceType: "desktop", browser: "Chrome", os: "macOS", country: "IE" }),
      new Date(now - Math.random() * 1000 * 60 * 60 * 24 * 14),
    ]
  );
  await pool.query(
    `INSERT INTO response_answers (response_id, question_id, type, value) VALUES ($1, $2, $3, $4)`,
    [surveyResponse.rows[0].id, q1.rows[0].id, "rating", JSON.stringify(2)]
  );
  await pool.query(
    `INSERT INTO response_answers (response_id, question_id, type, value) VALUES ($1, $2, $3, $4)`,
    [surveyResponse.rows[0].id, null, "text", JSON.stringify("Checkout felt slower than expected.")]
  );

  console.log("Seed complete.");
  console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Demo public project key: ${DEMO_PUBLIC_KEY}`);

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
