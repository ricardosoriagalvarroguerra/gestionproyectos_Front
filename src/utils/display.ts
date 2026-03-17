import { PersonValue } from "../api/client";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toTimeValue(value?: string | null, fallback = Number.POSITIVE_INFINITY): number {
  const parsed = parseApiDate(value);
  return parsed ? parsed.getTime() : fallback;
}

export function formatDateLabel(value?: string | null, fallback = "Sin fecha"): string {
  const parsed = parseApiDate(value);
  return parsed ? parsed.toLocaleDateString() : fallback;
}

export function formatDateTimeLabel(value?: string | null, fallback = "Sin fecha"): string {
  const parsed = parseApiDate(value);
  return parsed ? parsed.toLocaleString() : fallback;
}

export function formatDateRangeLabel(
  start?: string | null,
  end?: string | null,
  fallback = "Sin fecha"
): string {
  const startLabel = start ? formatDateLabel(start, "") : "";
  const endLabel = end ? formatDateLabel(end, "") : "";
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel || endLabel || fallback;
}

export function formatRelativeDueLabel(
  value?: string | null,
  labels: { today: string; upcomingPrefix: string; overduePrefix: string } = {
    today: "Vence hoy",
    upcomingPrefix: "Faltan",
    overduePrefix: "Atrasado",
  }
): string | null {
  const target = parseApiDate(value);
  if (!target) return null;
  const today = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((targetDay.getTime() - todayDay.getTime()) / 86400000);
  if (diff === 0) return labels.today;
  if (diff > 0) return `${labels.upcomingPrefix} ${diff} días`;
  return `${labels.overduePrefix} ${Math.abs(diff)} días`;
}

export function personLabel(value: PersonValue): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return personLabel(value[0] ?? null);
  if (typeof value === "string") return value;
  return value.name || value.full_name || value.plain_text || value.title || value.email || value.id || null;
}

export function statusBadgeClass(value?: string | null, options?: { emptyIsNeutral?: boolean }): string {
  const normalized = normalizeText(value);
  if (!normalized || normalized === "sin empezar" || normalized === "pendiente") {
    return options?.emptyIsNeutral === false ? "ui-badge ui-badge--accent" : "ui-badge ui-badge--neutral";
  }
  if (["completado", "completo", "listo", "terminado", "hecho", "entregado"].includes(normalized)) {
    return "ui-badge ui-badge--success";
  }
  if (["en progreso", "en curso", "activo", "ejecucion", "en ejecucion"].includes(normalized)) {
    return "ui-badge ui-badge--info";
  }
  if (["bloqueado", "bloqueada", "en riesgo", "riesgo"].includes(normalized)) {
    return "ui-badge ui-badge--warning";
  }
  if (["cancelado", "cancelada", "atrasado", "atrasada"].includes(normalized)) {
    return "ui-badge ui-badge--danger";
  }
  return "ui-badge ui-badge--accent";
}

export function priorityBadgeClass(value?: string | null): string {
  const normalized = normalizeText(value);
  if (!normalized || normalized === "normal") return "ui-badge ui-badge--neutral";
  if (["urgente", "alta", "critica", "critico"].includes(normalized)) {
    return "ui-badge ui-badge--danger";
  }
  if (["media"].includes(normalized)) {
    return "ui-badge ui-badge--warning";
  }
  if (["baja"].includes(normalized)) {
    return "ui-badge ui-badge--neutral";
  }
  return "ui-badge ui-badge--accent";
}
