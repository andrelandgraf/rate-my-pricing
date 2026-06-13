"use client";

import { useEffect } from "react";

/**
 * Warms this page's social images as soon as it's viewed, so that by the time the
 * user clicks "Share" and X/Slack crawl the og:image, it's already a CDN cache HIT
 * (the image route is ISR-cached, so the warm persists). Reads the exact image URLs
 * (with their cache-busting query) straight from the rendered meta tags.
 */
export default function PrewarmOg() {
  useEffect(() => {
    const urls = Array.from(
      document.querySelectorAll<HTMLMetaElement>(
        'meta[property="og:image"], meta[name="twitter:image"]',
      ),
    )
      .map((m) => m.content)
      .filter(Boolean);

    for (const url of new Set(urls)) {
      const img = new Image();
      img.src = url;
    }
  }, []);

  return null;
}
