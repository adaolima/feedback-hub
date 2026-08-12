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

/**
 * True for routes authenticated via project public key rather than a user session: everything
 * under /api/v1/public/* plus POST /api/v1/responses. Also matches the CORS preflight (OPTIONS)
 * for that POST route via the Access-Control-Request-Method header, since the preflight itself
 * arrives with method OPTIONS, not POST.
 */
function isPublicRoute(req: express.Request): boolean {
  if (req.path.startsWith("/api/v1/public")) return true;
  const method = req.method === "OPTIONS" ? req.header("Access-Control-Request-Method") : req.method;
  return req.path === "/api/v1/responses" && method === "POST";
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  // Every response here is meant to be consumed cross-origin: the dashboard and the API are
  // different origins, and the public/SDK surface is embedded on arbitrary customer websites.
  // Helmet's default same-origin CORP would let the browser block those loads even where CORS
  // allows them (a separate, independent check) — see TODO.md for the bug this fixes.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  // The public, SDK-facing surface (project-public-key auth, no cookies) is embedded on arbitrary
  // customer websites and must accept any origin. The cookie-authenticated admin API must not.
  app.use((req, res, next) => {
    const corsOptions = isPublicRoute(req)
      ? { origin: true, credentials: false }
      : { origin: env.corsOrigins, credentials: true };
    cors(corsOptions)(req, res, next);
  });
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
