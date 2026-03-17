import { JsonObject, JsonValue } from "../api/client";
import { formatDateLabel, formatDateRangeLabel, formatDateTimeLabel } from "../utils/display";

export type ExtraProperties = JsonObject | null | undefined;

type ExtraPropertyEntry = {
  id: string;
  label: string;
  value: string;
};

export function getExtraPropertyEntries(
  properties: ExtraProperties,
  options?: { limit?: number }
): ExtraPropertyEntry[] {
  if (!properties) return [];

  const entries = Object.entries(properties)
    .map(([id, value]) => {
      const entry = resolveExtraEntry(id, value);
      const formatted = formatExtraValue(entry.value);
      if (!formatted) return null;
      return { id: entry.id, label: entry.label, value: formatted };
    })
    .filter((entry): entry is ExtraPropertyEntry => !!entry);

  if (!options?.limit) return entries;
  return entries.slice(0, options.limit);
}

export function searchableExtraPropertiesText(properties: ExtraProperties): string {
  return getExtraPropertyEntries(properties)
    .map((entry) => `${entry.label} ${entry.value}`)
    .join(" ")
    .toLowerCase();
}

export function PropertyPills({
  properties,
  limit = 2,
  className = "",
  excludeLabels = [],
}: {
  properties: ExtraProperties;
  limit?: number;
  className?: string;
  excludeLabels?: string[];
}) {
  const excluded = new Set(excludeLabels.map((label) => label.trim().toLowerCase()));
  const entries = getExtraPropertyEntries(properties)
    .filter((entry) => !excluded.has(entry.label.trim().toLowerCase()))
    .slice(0, limit);
  if (!entries.length) return null;

  return (
    <div className={`mt-2 flex flex-wrap gap-1.5 ${className}`.trim()}>
      {entries.map((entry) => (
        <span
          key={entry.id}
          className="ui-badge ui-badge--neutral max-w-full"
          title={`${entry.label}: ${entry.value}`}
        >
          <span className="truncate">
            {entry.label}: {entry.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function PropertyGrid({
  properties,
  className = "",
}: {
  properties: ExtraProperties;
  className?: string;
}) {
  const entries = getExtraPropertyEntries(properties);
  if (!entries.length) return null;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`.trim()}>
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-border-muted bg-panel p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-secondary">{entry.label}</div>
          <div className="mt-1 text-sm leading-5 text-primary">{entry.value}</div>
        </div>
      ))}
    </div>
  );
}

function resolveExtraEntry(id: string, value: JsonValue | undefined): {
  id: string;
  label: string;
  value: JsonValue | undefined;
} {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value &&
    typeof value.label === "string"
  ) {
    const record = value as JsonObject;
    return {
      id,
      label: value.label,
      value: record.value,
    };
  }

  return { id, label: id, value };
}

function formatExtraValue(value: JsonValue | undefined, depth = 0): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatExtraValue(item, depth + 1))
      .filter((item): item is string => !!item);
    if (!parts.length) return null;
    if (parts.length <= 3) return parts.join(", ");
    return `${parts.slice(0, 3).join(", ")} +${parts.length - 3}`;
  }

  if (typeof value === "object") {
    const record = value as JsonObject;

    if (depth < 4 && typeof record.type === "string" && record.type in record) {
      const typedValue = formatExtraValue(record[record.type], depth + 1);
      if (typedValue) return typedValue;
    }

    if ("start" in record || "end" in record) {
      const start = typeof record.start === "string" ? record.start : null;
      const end = typeof record.end === "string" ? record.end : null;
      if (start || end) return formatDateRange(start, end);
    }

    const directValue = [
      record.name,
      record.full_name,
      record.plain_text,
      record.title,
      record.email,
      record.id,
    ].find((item): item is string => typeof item === "string" && !!item.trim());
    if (directValue) return directValue;

    if (depth >= 4) return null;

    const nested = Object.values(record)
      .map((item) => formatExtraValue(item, depth + 1))
      .filter((item): item is string => !!item);

    if (!nested.length) return null;
    if (nested.length <= 3) return nested.join(", ");
    return `${nested.slice(0, 3).join(", ")} +${nested.length - 3}`;
  }

  return null;
}

function formatDateRange(start?: string | null, end?: string | null) {
  return formatDateRangeLabel(start, end, "");
}

function formatDateValue(value: string) {
  return value.includes("T") ? formatDateTimeLabel(value, value) : formatDateLabel(value, value);
}
