import { Mastra } from "@mastra/core/mastra";
import { Observability, MastraPlatformExporter } from "@mastra/observability";
import { extractorPrimary, extractorFallback, analyst, categorizer, explorer, judge } from "./agents/pricing";

// MastraPlatformExporter reads MASTRA_PLATFORM_ACCESS_TOKEN + MASTRA_PROJECT_ID from the env.
// Only wire observability once both are present (Observability requires >=1 exporter), so the
// app runs fine before the Mastra Cloud project exists.
const platformReady = Boolean(
  process.env.MASTRA_PLATFORM_ACCESS_TOKEN && process.env.MASTRA_PROJECT_ID,
);

const observability = platformReady
  ? new Observability({
      configs: {
        default: {
          serviceName: "rate-my-pricing",
          exporters: [new MastraPlatformExporter()],
        },
      },
    })
  : undefined;

export const mastra = new Mastra({
  agents: { extractorPrimary, extractorFallback, analyst, categorizer, explorer, judge },
  ...(observability ? { observability } : {}),
});
