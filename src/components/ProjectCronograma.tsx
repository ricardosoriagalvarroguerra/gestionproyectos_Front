import { useEffect, useMemo, useRef, useState } from "react";
import { TimelineResponse } from "../api/client";
import { parseApiDate } from "../utils/display";

type Mode = "products" | "tasks";

type Week = {
  start: Date;
  end: Date;
  monthKey: string;
  monthLabel: string;
  rangeLabel: string;
  year: number;
};

type Props = {
  data?: TimelineResponse;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  loading?: boolean;
};

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const STATUS_LABELS: Record<string, string> = {
  listo: "Listo",
  completado: "Listo",
  completo: "Listo",
  terminado: "Listo",
  hecho: "Listo",
  entregado: "Listo",
  "en curso": "En curso",
  "en progreso": "En curso",
  activo: "En curso",
  ejecucion: "En curso",
  "en ejecucion": "En curso",
  bloqueado: "Bloqueada",
  bloqueada: "Bloqueada",
  "en riesgo": "Bloqueada",
  riesgo: "Bloqueada",
  "sin empezar": "Sin empezar",
  pendiente: "Sin empezar",
};

function statusKey(value?: string | null): "listo" | "en-curso" | "bloqueada" | "sin-empezar" {
  const norm = (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!norm) return "sin-empezar";
  if (["listo", "completado", "completo", "terminado", "hecho", "entregado"].includes(norm)) return "listo";
  if (["en curso", "en progreso", "activo", "ejecucion", "en ejecucion"].includes(norm)) return "en-curso";
  if (["bloqueado", "bloqueada", "en riesgo", "riesgo"].includes(norm)) return "bloqueada";
  return "sin-empezar";
}

function statusLabel(value?: string | null): string {
  const norm = (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return STATUS_LABELS[norm] || (value ? value : "Sin empezar");
}

function statusColors(key: ReturnType<typeof statusKey>) {
  if (key === "listo") return { bg: "var(--success-soft)", border: "var(--success)" };
  if (key === "en-curso") return { bg: "var(--info-soft)", border: "var(--info)" };
  if (key === "bloqueada") return { bg: "var(--warning-soft)", border: "var(--warning)" };
  return { bg: "var(--bg-soft)", border: "var(--text-faint)" };
}

function startOfWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0=Sun, 1=Mon
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

function dd(n: number) {
  return String(n).padStart(2, "0");
}

function fmtRange(start: Date, end: Date): string {
  return `${dd(start.getDate())}/${dd(start.getMonth() + 1)} – ${dd(end.getDate())}/${dd(end.getMonth() + 1)}`;
}

function buildWeeks(min: Date, max: Date): Week[] {
  const weeks: Week[] = [];
  let cursor = startOfWeek(min);
  const endCursor = startOfWeek(max);
  // Stop after we've passed the max date by one full week.
  while (cursor.getTime() <= endCursor.getTime()) {
    const wEnd = addDays(cursor, 6);
    const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    weeks.push({
      start: new Date(cursor),
      end: wEnd,
      monthKey,
      monthLabel: MONTH_SHORT[cursor.getMonth()],
      rangeLabel: fmtRange(cursor, wEnd),
      year: cursor.getFullYear(),
    });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function findWeekIndex(weeks: Week[], date: Date | null): number {
  if (!date) return -1;
  const t = date.getTime();
  for (let i = 0; i < weeks.length; i++) {
    if (t >= weeks[i].start.getTime() && t <= weeks[i].end.getTime() + 86_400_000) {
      return i;
    }
  }
  return -1;
}

export function ProjectCronograma({ data, mode, onModeChange, loading }: Props) {
  const today = useMemo(() => new Date(), []);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const groups = data?.groups || [];
  const items = data?.items || [];

  // Build week list from item dates (or fallback to a 12-week window around today).
  const weeks = useMemo(() => {
    const dates: Date[] = [];
    items.forEach((it) => {
      const s = parseApiDate(it.start);
      const e = parseApiDate(it.end);
      if (s) dates.push(s);
      if (e) dates.push(e);
    });
    if (dates.length === 0) {
      const start = addDays(today, -28);
      const end = addDays(today, 56);
      return buildWeeks(start, end);
    }
    let min = dates[0];
    let max = dates[0];
    dates.forEach((d) => {
      if (d.getTime() < min.getTime()) min = d;
      if (d.getTime() > max.getTime()) max = d;
    });
    // Pad ±2 weeks for breathing room
    return buildWeeks(addDays(min, -14), addDays(max, 14));
  }, [items, today]);

  const todayIdx = useMemo(() => findWeekIndex(weeks, today), [weeks, today]);

  // Group items by group, preserving the order of `groups`.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((it) => {
      const key = it.group || "_";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    const ordered: { id: string; label: string; items: typeof items }[] = [];
    groups.forEach((g) => {
      const list = map.get(g.id);
      if (list && list.length > 0) ordered.push({ id: g.id, label: g.label || "Grupo", items: list });
      map.delete(g.id);
    });
    map.forEach((list, key) => {
      ordered.push({ id: key, label: "Sin grupo", items: list });
    });
    return ordered;
  }, [items, groups]);

  // Group weeks by month for the header band.
  const monthsHeader = useMemo(() => {
    const out: { key: string; label: string; span: number }[] = [];
    weeks.forEach((w) => {
      const last = out[out.length - 1];
      if (last && last.key === w.monthKey) last.span += 1;
      else out.push({ key: w.monthKey, label: w.monthLabel, span: 1 });
    });
    return out;
  }, [weeks]);

  const [year, setYear] = useState<number>(() => today.getFullYear());

  const yearsAvailable = useMemo(() => {
    const set = new Set<number>();
    weeks.forEach((w) => set.add(w.year));
    return Array.from(set).sort();
  }, [weeks]);

  // Auto-scroll to today's week on mount and whenever data changes.
  useEffect(() => {
    if (todayIdx < 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const cell = el.querySelector<HTMLElement>(`[data-week-idx="${todayIdx}"]`);
    if (cell) {
      const left = cell.offsetLeft - 280;
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [todayIdx, weeks.length, mode]);

  const scrollToYear = (y: number) => {
    setYear(y);
    const el = scrollRef.current;
    if (!el) return;
    const idx = weeks.findIndex((w) => w.year === y);
    if (idx < 0) return;
    const cell = el.querySelector<HTMLElement>(`[data-week-idx="${idx}"]`);
    if (cell) {
      el.scrollTo({ left: Math.max(0, cell.offsetLeft - 260), behavior: "smooth" });
    }
  };

  const scrollToToday = () => {
    if (todayIdx < 0) return;
    setYear(today.getFullYear());
    const el = scrollRef.current;
    if (!el) return;
    const cell = el.querySelector<HTMLElement>(`[data-week-idx="${todayIdx}"]`);
    if (cell) {
      el.scrollTo({ left: Math.max(0, cell.offsetLeft - 260), behavior: "smooth" });
    }
  };

  const colTemplate = `var(--cronograma-label-col, 260px) repeat(${weeks.length}, minmax(70px, 1fr))`;
  const gridMinWidth = `calc(var(--cronograma-label-col, 260px) + ${weeks.length * 70}px)`;

  return (
    <div className={fullscreen ? "gp-cronograma-fullscreen" : ""}>
      {/* Controls row */}
      <div className="gp-row gp-cronograma-toolbar" style={{ marginBottom: 12, gap: 10 }}>
        <div className="ui-segmented">
          <button
            type="button"
            className={`ui-segment ${mode === "tasks" ? "is-active" : ""}`}
            onClick={() => onModeChange("tasks")}
          >
            Tareas
          </button>
          <button
            type="button"
            className={`ui-segment ${mode === "products" ? "is-active" : ""}`}
            onClick={() => onModeChange("products")}
          >
            Productos
          </button>
        </div>
        <span className="gp-spacer-flex" />
        <div className="gp-row" style={{ gap: 6 }}>
          <button
            type="button"
            className="gp-icon-btn"
            onClick={() => {
              const idx = yearsAvailable.indexOf(year);
              if (idx > 0) scrollToYear(yearsAvailable[idx - 1]);
            }}
            disabled={yearsAvailable.indexOf(year) <= 0}
            title="Año anterior"
            style={{ opacity: yearsAvailable.indexOf(year) <= 0 ? 0.4 : 1 }}
          >
            <svg width={12} height={12} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 4 4 4-4 4" transform="rotate(180 9 9)" />
            </svg>
          </button>
          <span className="mono" style={{ fontSize: 13, padding: "0 12px" }}>{year}</span>
          <button
            type="button"
            className="gp-icon-btn"
            onClick={() => {
              const idx = yearsAvailable.indexOf(year);
              if (idx >= 0 && idx < yearsAvailable.length - 1) scrollToYear(yearsAvailable[idx + 1]);
            }}
            disabled={yearsAvailable.indexOf(year) >= yearsAvailable.length - 1}
            title="Año siguiente"
            style={{
              opacity:
                yearsAvailable.indexOf(year) >= yearsAvailable.length - 1 ? 0.4 : 1,
            }}
          >
            <svg width={12} height={12} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 4 4 4-4 4" />
            </svg>
          </button>
          <button
            type="button"
            className="ui-button"
            style={{ height: 28, padding: "0 10px" }}
            onClick={scrollToToday}
            disabled={todayIdx < 0}
          >
            Hoy
          </button>
          <button
            type="button"
            className="gp-icon-btn"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            <svg width={13} height={13} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen ? (
                <path d="M3 6.5h3.5V3M15 11.5H11.5V15M11.5 3v3.5H15M3 11.5h3.5V15" />
              ) : (
                <path d="M3 6.5V3h3.5M15 11.5V15h-3.5M11.5 3H15v3.5M3 11.5V15h3.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="gp-card" style={{ overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Cargando cronograma…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No hay {mode === "products" ? "productos" : "tareas"} con fechas en este proyecto.
          </div>
        )}
        {!loading && items.length > 0 && (
          <div ref={scrollRef} style={{ overflowX: "auto" }}>
            {/* Header — month band */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: colTemplate,
                borderBottom: "1px solid var(--border-muted)",
                minWidth: gridMinWidth,
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--border-muted)",
                  background: "var(--bg-surface)",
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                }}
              >
                Item / Semana
              </div>
              {monthsHeader.map((m) => (
                <div
                  key={m.key}
                  style={{
                    gridColumn: `span ${m.span}`,
                    padding: "6px 0",
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderLeft: "1px solid var(--border-muted)",
                    borderBottom: "1px solid var(--border-muted)",
                  }}
                >
                  {m.label}
                </div>
              ))}
              {/* Empty cell under "Item / Semana" for week labels row */}
              <div style={{ background: "var(--bg-surface)", position: "sticky", left: 0, zIndex: 2 }} />
              {weeks.map((w, i) => (
                <div
                  key={i}
                  data-week-idx={i}
                  className="mono"
                  style={{
                    padding: "6px 4px",
                    textAlign: "center",
                    fontSize: 10,
                    color: i === todayIdx ? "var(--accent-text)" : "var(--text-muted)",
                    borderLeft: "1px solid var(--border-muted)",
                    background: i === todayIdx ? "var(--accent-soft)" : "transparent",
                    fontWeight: i === todayIdx ? 500 : 400,
                  }}
                >
                  {w.rangeLabel}
                </div>
              ))}
            </div>

            {/* Body — groups + items */}
            {grouped.map((g) => (
              <div key={g.id}>
                {/* Group row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: colTemplate,
                    background: "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-muted)",
                    minWidth: gridMinWidth,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      position: "sticky",
                      left: 0,
                      background: "var(--bg-muted)",
                      zIndex: 1,
                    }}
                  >
                    {g.label}
                  </div>
                  {weeks.map((_, i) => (
                    <div key={i} style={{ borderLeft: "1px solid var(--border-muted)" }} />
                  ))}
                </div>
                {/* Item rows */}
                {g.items.map((it) => {
                  const startDate = parseApiDate(it.start);
                  const endDate = parseApiDate(it.end);
                  const startW = findWeekIndex(weeks, startDate);
                  const endW = findWeekIndex(weeks, endDate);
                  const sKey = statusKey(it.status);
                  const colors = statusColors(sKey);
                  const sLabel = statusLabel(it.status);
                  return (
                    <div
                      key={it.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: colTemplate,
                        borderBottom: "1px solid var(--border-muted)",
                        minWidth: gridMinWidth,
                      }}
                    >
                      <div
                        className="gp-row"
                        style={{
                          padding: "8px 12px",
                          gap: 8,
                          position: "sticky",
                          left: 0,
                          background: "var(--bg-panel)",
                          zIndex: 1,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            background: colors.border,
                            flex: "none",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="gp-truncate" style={{ fontSize: 12.5 }}>
                            {it.label || "Sin nombre"}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{sLabel}</div>
                        </div>
                      </div>
                      {weeks.map((_, i) => {
                        const inBar =
                          startW >= 0 &&
                          endW >= 0 &&
                          i >= Math.min(startW, endW) &&
                          i <= Math.max(startW, endW);
                        const isLeft = i === startW;
                        const isRight = i === endW;
                        const isToday = i === todayIdx;
                        return (
                          <div
                            key={i}
                            style={{
                              borderLeft: "1px solid var(--border-muted)",
                              padding: "8px 0",
                              position: "relative",
                              background: isToday ? "var(--accent-soft)" : "transparent",
                              height: 38,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {inBar && (
                              <div
                                title={`${it.label || ""} · ${sLabel}`}
                                style={{
                                  flex: 1,
                                  height: 18,
                                  background: colors.bg,
                                  borderLeft: isLeft ? `2px solid ${colors.border}` : "none",
                                  borderRight: isRight ? `2px solid ${colors.border}` : "none",
                                  borderTopLeftRadius: isLeft ? 3 : 0,
                                  borderBottomLeftRadius: isLeft ? 3 : 0,
                                  borderTopRightRadius: isRight ? 3 : 0,
                                  borderBottomRightRadius: isRight ? 3 : 0,
                                  marginRight: isRight ? 4 : -1,
                                  marginLeft: isLeft ? 4 : -1,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
