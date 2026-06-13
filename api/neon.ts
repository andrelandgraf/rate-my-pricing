import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    aiGateway: true,
    functions: {
      ratemypricing: {
        name: "rate-my-pricing api",
        source: "src/index.ts",
        // Neon-managed vars (DATABASE_URL, OPENAI_*, AI Gateway) are injected automatically.
        // Only third-party / custom env is declared here, resolved from process.env at deploy
        // time (load with `neonctl deploy --env .env.deploy`).
        env: {
          SENTRY_DSN: process.env.SENTRY_DSN ?? "",
          PRODUCTION_BRANCH_ID: process.env.PRODUCTION_BRANCH_ID ?? "",
          WEB_URL: process.env.WEB_URL ?? "",
          REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? "",
          RATE_LIMIT_PER_IP_PER_HOUR: process.env.RATE_LIMIT_PER_IP_PER_HOUR ?? "20",
          RATE_LIMIT_GLOBAL_PER_HOUR: process.env.RATE_LIMIT_GLOBAL_PER_HOUR ?? "300",
          MASTRA_PROJECT_ID: process.env.MASTRA_PROJECT_ID ?? "",
          MASTRA_PLATFORM_ACCESS_TOKEN: process.env.MASTRA_PLATFORM_ACCESS_TOKEN ?? "",
          FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ?? "",
        },
      },
    },
  },
});
