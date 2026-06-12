"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fdf6e8",
          color: "#1c1a17",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <div style={{ fontSize: "3rem" }}>🫠</div>
          <h2 style={{ fontWeight: 800, fontSize: "1.5rem", margin: "0.5rem 0" }}>
            Something broke
          </h2>
          <p style={{ color: "#514b40" }}>The agent will be notified. Try refreshing.</p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.25rem",
              border: "3px solid #1c1a17",
              borderRadius: 14,
              background: "#ff5d57",
              padding: "0.6rem 1.4rem",
              fontWeight: 800,
              textDecoration: "none",
              color: "#1c1a17",
            }}
          >
            ← Back home
          </Link>
        </div>
      </body>
    </html>
  );
}
