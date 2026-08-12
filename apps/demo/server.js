const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT ?? 3001;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const DEMO_PROJECT_KEY = process.env.DEMO_PROJECT_KEY ?? "pk_demo_00000000000000000000000000";

app.get("/config.js", (_req, res) => {
  res.type("application/javascript").send(
    `window.FEEDBACKHUB_DEMO_CONFIG = ${JSON.stringify({ apiBaseUrl: API_BASE_URL, projectKey: DEMO_PROJECT_KEY })};`
  );
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`FeedbackHub demo site listening on port ${PORT}`);
});
