"use client";

import { useSyncExternalStore } from "react";

type Mode = "auto" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<Mode, string> = { auto: "Auto (device)", light: "Light", dark: "Dark" };

const subscribe = (cb: () => void) => {
  window.addEventListener("themechange", cb);
  return () => window.removeEventListener("themechange", cb);
};
const read = (): Mode => (document.documentElement.dataset.theme as Mode | undefined) ?? "auto";

function apply(mode: Mode) {
  if (mode === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  try {
    if (mode === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", mode);
  } catch {
    // storage blocked: the choice lasts until reload
  }
  window.dispatchEvent(new Event("themechange"));
}

const icons: Record<Mode, string> = {
  auto: "M12 3a9 9 0 1 0 0 18V3Z M12 3a9 9 0 0 1 0 18",
  light: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  dark: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
};

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "auto" as Mode);
  return (
    <button
      type="button"
      onClick={() => apply(NEXT[mode])}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-muted transition-colors duration-200 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={icons[mode]} />
      </svg>
      <span>{LABEL[mode]}</span>
    </button>
  );
}
