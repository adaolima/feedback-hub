import { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).requestId;

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details, requestId },
    });
  }

  // eslint-disable-next-line no-console
  console.error(`[${requestId}]`, err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}
