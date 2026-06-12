import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org: "andre-landgraf",
  project: "rate-my-pricing",
  // Auth token (SENTRY_AUTH_TOKEN) is read from the environment for source-map upload.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  // Route Sentry requests through the app to dodge ad-blockers.
  tunnelRoute: "/monitoring",
});
