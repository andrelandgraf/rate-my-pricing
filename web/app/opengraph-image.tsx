import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Rate My Pricing — how confusing is that pricing page?";

const PAPER = "#fdf6e8";
const CARD = "#fffdf7";
const INK = "#1c1a17";
const INK_SOFT = "#514b40";
const CORAL = "#ff5d57";
const GREEN = "#16a34a";
const TRACK = "rgba(28,26,23,0.12)";

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

function Gauge({ label }: { label: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 180 }}>
      <div style={{ display: "flex", position: "relative", width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx="80" cy="80" r={radius} fill={CARD} stroke={INK} strokeWidth="18" />
          <circle cx="80" cy="80" r={radius} fill="none" stroke={TRACK} strokeWidth="11" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={GREEN}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: GREEN }}>100</div>
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 22, fontWeight: 800, color: INK }}>{label}</div>
    </div>
  );
}

export default async function Image() {
  const [display, body] = await Promise.all([
    loadFont("Bricolage+Grotesque", 800),
    loadFont("Space+Grotesk", 500),
  ]);
  const fonts = [
    display && { name: "Display", data: display, weight: 800 as const, style: "normal" as const },
    body && { name: "Body", data: body, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: "normal" }[];
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
        <div style={{ position: "absolute", top: -90, left: -60, width: 340, height: 340, borderRadius: 340, backgroundColor: "#ffb22e", opacity: 0.28, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -120, right: 100, width: 360, height: 360, borderRadius: 360, backgroundColor: "#4cc9f0", opacity: 0.2, display: "flex" }} />
        <div style={{ position: "absolute", top: 30, right: -70, width: 280, height: 280, borderRadius: 280, backgroundColor: "#9b5de5", opacity: 0.16, display: "flex" }} />

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
            padding: 56,
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
                  backgroundColor: "#ffb22e",
                  color: INK,
                  fontSize: 22,
                  fontWeight: 800,
                  padding: "6px 18px",
                  fontFamily: displayFamily,
                }}
              >
                the pricing-page roast machine
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, fontWeight: 800, color: INK, marginTop: 26, fontFamily: displayFamily, lineHeight: 1.02 }}>
                <span style={{ display: "flex" }}>How&nbsp;</span>
                <span style={{ display: "flex", color: CORAL }}>confusing</span>
                <span style={{ display: "flex" }}>&nbsp;is that pricing page?</span>
              </div>
              <div style={{ display: "flex", fontSize: 27, color: INK_SOFT, marginTop: 22, maxWidth: 600, lineHeight: 1.3 }}>
                Paste a URL. An AI agent reads it and scores how clear the pricing is — like Lighthouse, but for pricing pages.
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: INK }}>ratemypricing.vercel.app</div>
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
            <Gauge label="Pricing clarity" />
            <Gauge label="Agent easiness" />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
