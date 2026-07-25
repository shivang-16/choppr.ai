/** Shared date-range helpers for Choppr Metrics. */

export type DateRangePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "all"
  | "custom";

export type DateRange = {
  preset: DateRangePreset;
  /** Inclusive start (ISO). Null = unbounded. */
  from: string | null;
  /** Inclusive end (ISO). Null = unbounded. */
  to: string | null;
};

export type ParsedDateRange = {
  preset: DateRangePreset;
  from: Date | null;
  to: Date | null;
  label: string;
  /** Cache / query key */
  key: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar date YYYY-MM-DD */
export function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseDateInput(value: string, end = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(y!, m! - 1, day!);
  if (Number.isNaN(d.getTime())) return null;
  return end ? endOfLocalDay(d) : startOfLocalDay(d);
}

export function defaultDateRange(): DateRange {
  const to = endOfLocalDay(new Date());
  const from = startOfLocalDay(new Date());
  from.setDate(from.getDate() - 6); // last 7 calendar days including today
  return {
    preset: "7d",
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function rangeFromPreset(preset: DateRangePreset): DateRange {
  if (preset === "all") {
    return { preset: "all", from: null, to: null };
  }
  if (preset === "custom") {
    return defaultDateRange();
  }

  const to = endOfLocalDay(new Date());
  const from = startOfLocalDay(new Date());

  if (preset === "today") {
    // from already today
  } else if (preset === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "30d") {
    from.setDate(from.getDate() - 29);
  } else if (preset === "90d") {
    from.setDate(from.getDate() - 89);
  }

  return {
    preset,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function rangeFromCustom(fromStr: string, toStr: string): DateRange {
  const from = parseDateInput(fromStr, false);
  const to = parseDateInput(toStr, true);
  if (!from || !to) return defaultDateRange();
  if (from > to) {
    return {
      preset: "custom",
      from: startOfLocalDay(to).toISOString(),
      to: endOfLocalDay(from).toISOString(),
    };
  }
  return {
    preset: "custom",
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function parseDateRange(input?: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): ParsedDateRange {
  const presetRaw = input?.preset ?? "7d";
  const preset: DateRangePreset =
    presetRaw === "today" ||
    presetRaw === "7d" ||
    presetRaw === "30d" ||
    presetRaw === "90d" ||
    presetRaw === "all" ||
    presetRaw === "custom"
      ? presetRaw
      : "7d";

  let from: Date | null = null;
  let to: Date | null = null;

  if (preset === "all") {
    return {
      preset: "all",
      from: null,
      to: null,
      label: "All time",
      key: "all",
    };
  }

  if (preset !== "custom") {
    const built = rangeFromPreset(preset);
    from = built.from ? new Date(built.from) : null;
    to = built.to ? new Date(built.to) : null;
  } else {
    from = input?.from ? new Date(input.from) : null;
    to = input?.to ? new Date(input.to) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      const fallback = defaultDateRange();
      from = new Date(fallback.from!);
      to = new Date(fallback.to!);
    }
  }

  const label = formatRangeLabel(preset, from, to);
  const key = `${preset}:${from?.toISOString() ?? ""}:${to?.toISOString() ?? ""}`;

  return { preset, from, to, label, key };
}

export function formatRangeLabel(
  preset: DateRangePreset,
  from: Date | null,
  to: Date | null
) {
  if (preset === "all") return "All time";
  if (preset === "today") return "Today";
  if (preset === "7d") return "Last 7 days";
  if (preset === "30d") return "Last 30 days";
  if (preset === "90d") return "Last 90 days";
  if (!from || !to) return "Custom";
  const a = from.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const b = to.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${a} – ${b}`;
}

/** Mongo match fragment for createdAt within range. */
export function createdAtMatch(range: ParsedDateRange): Record<string, Date> | null {
  if (!range.from && !range.to) return null;
  const createdAt: Record<string, Date> = {};
  if (range.from) createdAt.$gte = range.from;
  if (range.to) createdAt.$lte = range.to;
  return createdAt;
}

export function rangeQueryParams(range: DateRange): string {
  const sp = new URLSearchParams();
  sp.set("preset", range.preset);
  if (range.from) sp.set("from", range.from);
  if (range.to) sp.set("to", range.to);
  return sp.toString();
}

export function parseRangeFromSearchParams(
  sp: URLSearchParams | { get(name: string): string | null }
): ParsedDateRange {
  return parseDateRange({
    preset: sp.get("preset"),
    from: sp.get("from"),
    to: sp.get("to"),
  });
}

export const RANGE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];
