"use client";

import { useState } from "react";

/** Web Share API; falls back to copying the link and opening WhatsApp with it. */
export function ShareLocation({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) return await navigator.share({ title, url });
      await navigator.clipboard?.writeText(url);
      setCopied(true);
    } catch {
      // user dismissed the share sheet
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, "_blank", "noopener");
  }

  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm">
      {copied ? "Link copied" : "Share location"}
    </button>
  );
}
