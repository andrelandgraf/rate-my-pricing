import { defineConfig } from "@neondatabase/config/v1";

export default defineConfig({
  preview: {
    aiGateway: true,
    functions: {
      ratemypricing: {
        name: "rate-my-pricing api",
        source: "src/index.ts",
      },
    },
  },
});
