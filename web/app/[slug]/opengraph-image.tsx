import { ImageResponse } from "next/og";
import { API_URL } from "@/lib/api";
import type { Rating } from "@/lib/types";
import { scoreColor, pricingLabel, agentLabel, hostOf } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Rate My Pricing — score card";

// ISR-cache the rendered card so a single pre-warm serves crawlers a cached PNG for a day.
export const revalidate = 86400;

async function getRating(slug: string): Promise<Rating | null> {
  try {
    const res = await fetch(`${API_URL}/ratings/${encodeURIComponent(slug)}`, {
      next: { revalidate: 86400 },
    });
    return res.ok ? ((await res.json()) as Rating) : null;
  } catch {
    return null;
  }
}

const PAPER = "#fdf6e8";
const CARD = "#fffdf7";
const INK = "#1c1a17";
const INK_SOFT = "#514b40";
const TRACK = "rgba(28,26,23,0.12)";

const FONT_TTL = 60 * 60 * 24 * 365; // cache font bytes ~forever (Data Cache)

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: FONT_TTL } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    return await fetch(url, { next: { revalidate: FONT_TTL } }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

// Memoized per warm instance so repeated renders skip the font work entirely.
let fontsPromise: Promise<[ArrayBuffer | null, ArrayBuffer | null]> | null = null;
function loadFonts(): Promise<[ArrayBuffer | null, ArrayBuffer | null]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      loadFont("Bricolage+Grotesque", 800),
      loadFont("Space+Grotesk", 500),
    ]);
  }
  return fontsPromise;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function Gauge({ score, label, caption }: { score: number; label: string; caption: string }) {
  const color = scoreColor(score);
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 230 }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 200,
          height: 200,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx="100" cy="100" r={radius} fill={CARD} stroke={INK} strokeWidth="20" />
          <circle cx="100" cy="100" r={radius} fill="none" stroke={TRACK} strokeWidth="13" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 74, fontWeight: 800, color }}>{score}</div>
      </div>
      <div style={{ display: "flex", marginTop: 16, fontSize: 26, fontWeight: 800, color: INK }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 19, color: INK_SOFT }}>{caption}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [rating, [display, body]] = await Promise.all([getRating(slug), loadFonts()]);

  const fonts = [
    display && { name: "Display", data: display, weight: 800 as const, style: "normal" as const },
    body && { name: "Body", data: body, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: "normal" }[];

  const title = truncate(rating?.title ?? "Unknown pricing page", 30);
  const host = rating ? hostOf(rating.url) : "ratemypricing.vercel.app";
  const summary = truncate(
    rating?.summary || "Paste any pricing page and let the agent rate how clear it is.",
    150,
  );
  const pricing = rating?.pricingScore ?? 0;
  const agent = rating?.agentScore ?? 0;
  const fontFamily = fonts.length ? "Body" : "sans-serif";
  const displayFamily = fonts.some((f) => f.name === "Display") ? "Display" : fontFamily;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 52,
          backgroundColor: PAPER,
          fontFamily,
          position: "relative",
        }}
      >
        {/* playful background blobs */}
        <div style={{ position: "absolute", top: -90, left: -60, width: 340, height: 340, borderRadius: 340, backgroundColor: "#ffb22e", opacity: 0.28, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -120, right: 120, width: 380, height: 380, borderRadius: 380, backgroundColor: "#4cc9f0", opacity: 0.22, display: "flex" }} />
        <div style={{ position: "absolute", top: 40, right: -80, width: 300, height: 300, borderRadius: 300, backgroundColor: "#9b5de5", opacity: 0.18, display: "flex" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            height: "100%",
            backgroundColor: CARD,
            border: `4px solid ${INK}`,
            borderRadius: 32,
            boxShadow: `14px 14px 0 ${INK}`,
            padding: 52,
            gap: 36,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  border: `3px solid ${INK}`,
                  borderRadius: 999,
                  backgroundColor: "#ff5d57",
                  color: INK,
                  fontSize: 22,
                  fontWeight: 800,
                  padding: "6px 18px",
                  fontFamily: displayFamily,
                }}
              >
                rate my pricing
              </div>
              <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: INK, marginTop: 26, fontFamily: displayFamily, lineHeight: 1.05 }}>
                {title}
              </div>
              <div style={{ display: "flex", fontSize: 26, color: INK_SOFT, marginTop: 8 }}>{host}</div>
              <div style={{ display: "flex", fontSize: 25, color: INK, marginTop: 22, maxWidth: 560, lineHeight: 1.35 }}>
                {summary}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 22, color: INK_SOFT }}>ratemypricing.vercel.app</div>
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 18 }}>
            <Gauge score={pricing} label="Pricing clarity" caption={pricingLabel(pricing)} />
            <Gauge score={agent} label="Agent easiness" caption={agentLabel(agent)} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
