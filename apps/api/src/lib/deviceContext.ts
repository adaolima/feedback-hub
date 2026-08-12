import { Request } from "express";
import { DeviceContext } from "@feedbackhub/shared";

/** Lightweight user-agent parsing. Avoids pulling in a heavy dependency for basic device/browser/OS detection. */
export function buildDeviceContext(req: Request, body: Record<string, unknown>): DeviceContext {
  const userAgent = (req.header("user-agent") ?? "").toString();
  const ua = userAgent.toLowerCase();

  let deviceType: DeviceContext["deviceType"] = "desktop";
  if (/mobile/.test(ua)) deviceType = "mobile";
  else if (/tablet|ipad/.test(ua)) deviceType = "tablet";

  let browser = "Unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  return {
    pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : undefined,
    pageTitle: typeof body.pageTitle === "string" ? body.pageTitle : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    userAgent,
    deviceType,
    browser,
    os,
    language: req.header("accept-language")?.split(",")[0],
    country: (req.header("cf-ipcountry") || req.header("x-country")) ?? undefined,
  };
}
