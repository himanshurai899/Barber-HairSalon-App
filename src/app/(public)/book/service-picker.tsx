"use client";

import { useState } from "react";
import { money, selectionSummary } from "@/lib/format";

type Item = { id: number; name: string; category: string; durationMin: number; priceMinor: number };

/** Step 1: tick one or more services. A plain GET form, so it works before JavaScript loads; JS only adds the running total. */
export function ServicePicker({ services, currency, src, selected }: { services: Item[]; currency: string; src?: string; selected: number[] }) {
  const [ids, setIds] = useState(new Set(selected));
  const groups = Map.groupBy(services, (x) => x.category);
  const summary = selectionSummary(services.filter((x) => ids.has(x.id)), currency);
  const toggle = (id: number) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <form action="/book" method="get" className="space-y-5">
      {src && <input type="hidden" name="src" value={src} />}
      {[...groups].map(([category, items]) => (
        <fieldset key={category} className="space-y-2">
          <legend className="mb-2 text-sm text-muted">{category}</legend>
          {items.map((x) => (
            <label key={x.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-4 py-2 has-[:checked]:border-ink">
              <input type="checkbox" name="service" value={x.id} checked={ids.has(x.id)} onChange={() => toggle(x.id)} className="size-5 shrink-0" />
              <span className="flex-1">
                {x.name} <span className="text-sm text-muted">{x.durationMin} min</span>
              </span>
              {x.priceMinor > 0 && <span>{money(x.priceMinor, currency)}</span>}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="sticky bottom-0 space-y-2 border-t border-line bg-bg py-3">
        <p role="status" aria-live="polite" className="text-sm">
          {summary}
        </p>
        <button
          type="submit"
          disabled={ids.size === 0}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-5 text-bg disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </form>
  );
}
