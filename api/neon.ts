import { defineConfig } from "@neon/config/v1";

// Function secrets (Sentry, Mastra, Firecrawl, revalidation) stay on the live
// deployment. Declaring them here would require values at every neon.ts load,
// including local drizzle, and an empty value deletes the live key.
export default defineConfig({
  aiGateway: true,
  functions: {
    ratemypricing: {
      name: "rate-my-pricing api",
      source: "src/index.ts",
    },
  },
});
