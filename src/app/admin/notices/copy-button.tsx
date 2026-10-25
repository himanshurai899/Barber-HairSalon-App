"use client";

import { useState } from "react";

/** Copies the WhatsApp-formatted text for pasting into the existing broadcast list. */
export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-2">
      <pre className="whitespace-pre-wrap rounded-md border border-line bg-bg p-3 text-sm">{text}</pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setDone(true);
        }}
        className="inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm"
      >
        {done ? "Copied" : "Copy for WhatsApp"}
      </button>
    </div>
  );
}
