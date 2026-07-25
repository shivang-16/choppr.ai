"use client";

import {
  RANGE_PRESETS,
  rangeFromCustom,
  rangeFromPreset,
  toDateInputValue,
  type DateRange,
  type DateRangePreset,
} from "@/lib/date-range";

export function DateRangeBar({
  value,
  onChange,
  disabled,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  disabled?: boolean;
}) {
  const fromInput = value.from
    ? toDateInputValue(new Date(value.from))
    : toDateInputValue(new Date());
  const toInput = value.to
    ? toDateInputValue(new Date(value.to))
    : toDateInputValue(new Date());

  function selectPreset(preset: DateRangePreset) {
    if (preset === "custom") {
      onChange({ ...value, preset: "custom" });
      return;
    }
    onChange(rangeFromPreset(preset));
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-1.5">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => selectPreset(p.id)}
            className={`rounded-full border px-2.5 py-1 text-[12px] transition disabled:opacity-50 ${
              value.preset === p.id
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(value.preset === "custom" || value.preset !== "all") && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-white/40">
            From
            <input
              type="date"
              disabled={disabled || value.preset === "all"}
              value={fromInput}
              onChange={(e) => {
                onChange(rangeFromCustom(e.target.value, toInput));
              }}
              className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-[12px] text-white outline-none focus:border-white/25 disabled:opacity-40"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-white/40">
            To
            <input
              type="date"
              disabled={disabled || value.preset === "all"}
              value={toInput}
              onChange={(e) => {
                onChange(rangeFromCustom(fromInput, e.target.value));
              }}
              className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-[12px] text-white outline-none focus:border-white/25 disabled:opacity-40"
            />
          </label>
        </div>
      )}
    </div>
  );
}
