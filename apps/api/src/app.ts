import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { env } from "./config/env";
import { pool } from "./db";
import { requestId } from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRateLimiter, authRateLimiter } from "./middleware/rateLimit";
import { authRouter } from "./modules/auth/routes";
import { organisationsRouter } from "./modules/organisations/routes";
import { projectsRouter } from "./modules/projects/routes";
import { widgetsRouter } from "./modules/widgets/routes";
import { surveysRouter } from "./modules/surveys/routes";
import { responsesRouter } from "./modules/responses/routes";
import { analyticsRouter } from "./modules/analytics/routes";
import { apiKeysRouter } from "./modules/apiKeys/routes";
import { webhooksRouter } from "./modules/webhooks/routes";
import { publicRouter } from "./modules/public/routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "healthy" });
    } catch {
      res.status(503).json({ status: "error", database: "unhealthy" });
    }
  });

  // Serve the compiled SDK bundle directly from the API for the simplest possible integration.
  const sdkDistPath = path.resolve(__dirname, "../../../packages/sdk/dist/sdk.js");
  app.get("/sdk.js", (_req, res) => {
    if (!fs.existsSync(sdkDistPath)) {
      return res.status(503).type("text/plain").send("SDK bundle not built yet. Run `npm run build:sdk`.");
    }
    res.type("application/javascript").sendFile(sdkDistPath);
  });

  const openapiPath = path.resolve(__dirname, "../openapi.yaml");
  if (fs.existsSync(openapiPath)) {
    const openapiDoc = YAML.load(openapiPath);
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
  }

  const v1 = express.Router();
  v1.use("/auth", authRateLimiter, authRouter);
  v1.use("/organisations", apiRateLimiter, organisationsRouter);
  v1.use("/projects", apiRateLimiter, projectsRouter);
  v1.use("/widgets", apiRateLimiter, widgetsRouter);
  v1.use("/surveys", apiRateLimiter, surveysRouter);
  v1.use("/responses", responsesRouter);
  v1.use("/analytics", apiRateLimiter, analyticsRouter);
  v1.use("/api-keys", apiRateLimiter, apiKeysRouter);
  v1.use("/webhooks", apiRateLimiter, webhooksRouter);
  v1.use("/public", publicRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
