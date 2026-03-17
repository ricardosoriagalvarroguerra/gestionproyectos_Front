import { useEffect, useMemo, useRef, useState } from "react";
import { TimelineItem, TimelineResponse } from "../api/client";
import { parseApiDate } from "../utils/display";

type Props = {
  data?: TimelineResponse;
  mode: "products" | "tasks";
  onModeChange: (m: "products" | "tasks") => void;
  loading?: boolean;
  className?: string;
  maxHeight?: number | string;
};

type NormalizedItem = TimelineItem & { startDate?: Date; endDate?: Date };
type WeekSlot = { start: Date; end: Date; label: string; isCurrent?: boolean };
type MonthSegment = { label: string; span: number; startIndex: number; date: Date };
type MonthView = {
  label: string;
  weeks: WeekSlot[];
  rows: RowView[];
  headerLabel: string;
  startDate: Date;
  monthSegments: MonthSegment[];
  cellMinWidth: number;
};
type RowView = {
  id: string;
  label: string;
  color: string;
  status?: string | null;
  progressPct?: number;
  startDate?: Date;
  endDate?: Date;
  isOverdue?: boolean;
  cells: CellView[];
  isHeader?: boolean;
};
type CellView = { active: boolean };
type FocusPayload = {
  viewLabel: string;
  rowId: string;
  rowLabel: string;
  status?: string | null;
  progressPct?: number;
  color: string;
  weekIndex: number;
  weekLabel: string;
  weekRange: string;
  itemRange?: string;
  isOverdue?: boolean;
  isCurrentWeek?: boolean;
};
type TooltipState = {
  payload: FocusPayload;
  x: number;
  y: number;
  placement: "top" | "bottom";
  mode: "hover" | "pinned";
};

export function Timeline({ data, mode, onModeChange, loading, className, maxHeight }: Props) {
  const items = useMemo(() => normalizeItems(data), [data]);
  const showEmpty = !loading && items.length === 0;
  const [granularity, setGranularity] = useState<"month" | "quarter" | "year">("month");
  const [focus, setFocus] = useState<FocusPayload | null>(null);
  const [pinned, setPinned] = useState<FocusPayload | null>(null);
  const effectiveMaxHeight = maxHeight ?? "520px";
  const monthViews = useMemo(
    () => buildViews(items, granularity, mode === "tasks" ? data?.groups : undefined),
    [items, data?.groups, mode, granularity]
  );
  const [activeMonth, setActiveMonth] = useState(0);
  const summary = useMemo(() => {
    const total = items.length;
    const label = mode === "tasks" ? "tareas" : "productos";
    const overdue = items.filter((item) => item.is_overdue).length;
    return { total, label, overdue };
  }, [items, mode]);

  useEffect(() => {
    if (!monthViews || monthViews.length === 0) return;
    setActiveMonth(findInitialIndex(monthViews, granularity));
  }, [monthViews, granularity]);

  useEffect(() => {
    if (!monthViews || monthViews.length === 0) {
      setFocus(null);
      setPinned(null);
      return;
    }
    setFocus((prev) => (prev && monthViews.some((view) => view.label === prev.viewLabel) ? prev : null));
    setPinned((prev) => (prev && monthViews.some((view) => view.label === prev.viewLabel) ? prev : null));
  }, [monthViews]);

  const currentView = monthViews?.[activeMonth];
  const monthStats = useMemo(() => {
    if (!currentView) return null;
    const activeRows = currentView.rows.filter((row) => !row.isHeader && row.cells.some((c) => c.active)).length;
    return { activeRows };
  }, [currentView]);

  const jumpToToday = () => {
    if (!monthViews || monthViews.length === 0) return;
    setActiveMonth(findInitialIndex(monthViews, granularity));
  };

  return (
    <div className={`glass timeline-shell flex flex-col min-w-0 pdf-avoid-break ${className || ""}`}>
      <div className="relative overflow-hidden border-b border-border-muted">
        <div className="relative flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold tracking-[0.24em] uppercase text-secondary">Cronograma</span>
                <SummaryChip label={summary.label} value={summary.total} />
                {monthStats && <SummaryChip label="visibles" value={monthStats.activeRows} tone="accent" />}
                {summary.overdue > 0 && <SummaryChip label="vencidas" value={summary.overdue} tone="danger" />}
              </div>
              <div className="text-[12px] text-secondary">
                {currentView ? currentView.label : "Sin rango disponible"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                ariaLabel="Vista de cronograma"
                value={mode}
                onChange={(value) => onModeChange(value as "products" | "tasks")}
                options={[
                  { value: "products", label: "Productos" },
                  { value: "tasks", label: "Tareas" },
                ]}
              />
              <label className="timeline-select-wrap">
                <span className="sr-only">Escala</span>
                <select
                  aria-label="Escala temporal"
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as "month" | "quarter" | "year")}
                  className="ui-select min-w-[122px]"
                >
                  <option value="month">Mes</option>
                  <option value="quarter">Trimestre</option>
                  <option value="year">Año</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-3">
            <div className="timeline-nav">
              <button
                className="timeline-nav-btn"
                onClick={() => setActiveMonth((i) => Math.max(0, i - 1))}
                disabled={!monthViews || activeMonth <= 0}
                aria-label="Periodo anterior"
              >
                ←
              </button>
              <div className="timeline-month-label">{currentView ? currentView.label : ""}</div>
              <button
                className="timeline-nav-btn"
                onClick={() => setActiveMonth((i) => (monthViews ? Math.min(monthViews.length - 1, i + 1) : i))}
                disabled={!monthViews || activeMonth >= (monthViews?.length ?? 1) - 1}
                aria-label="Periodo siguiente"
              >
                →
              </button>
            </div>
            <div className="flex items-center gap-2">
              {monthViews && monthViews.length > 1 && (
                <span className="text-[11px] text-secondary">
                  {activeMonth + 1}/{monthViews.length}
                </span>
              )}
              <button
                className="timeline-nav-btn"
                onClick={jumpToToday}
                disabled={!monthViews || !monthViews.length}
                aria-label="Ir a hoy"
              >
                Hoy
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="relative">
        {loading && <div className="absolute inset-0 grid place-items-center text-secondary text-sm">Cargando timeline...</div>}
        {showEmpty && (
          <div className="absolute inset-0 grid place-items-center text-secondary text-sm px-4 text-center">
            {mode === "tasks"
              ? "Sin tareas programadas para el proyecto."
              : "Sin fechas registradas para los productos del proyecto."}
          </div>
        )}
        {!loading && !showEmpty && currentView && (
          <MonthGrid
            views={[currentView]}
            maxHeight={effectiveMaxHeight}
            focus={focus}
            pinned={pinned}
            onFocusChange={setFocus}
            onPinChange={setPinned}
          />
        )}
      </div>
    </div>
  );
}

function normalizeItems(data?: TimelineResponse): NormalizedItem[] {
  if (!data?.items?.length) return [];
  return data.items
    .filter((item) => item.start || item.end)
    .map((item) => {
      const startDate = parseApiDate(item.start) ?? undefined;
      const endDate = parseApiDate(item.end) ?? startDate;
      let adjustedEnd = endDate;
      if (startDate && adjustedEnd && startDate.getTime() === adjustedEnd.getTime()) {
        adjustedEnd = new Date(adjustedEnd);
        adjustedEnd.setDate(adjustedEnd.getDate() + 1);
      }
      return { ...item, startDate: startDate ?? undefined, endDate: adjustedEnd ?? undefined };
    });
}

function buildViews(
  items: NormalizedItem[],
  granularity: "month" | "quarter" | "year",
  groups?: { id: string; label: string }[]
): MonthView[] | null {
  if (!items.length) return null;
  const dates = items.flatMap((i) => [i.startDate, i.endDate]).filter(Boolean) as Date[];
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(minDate.getFullYear(), currentYear - 1);
  const maxYear = Math.max(maxDate.getFullYear(), currentYear + 1);

  if (granularity === "month") {
    const monthStart = new Date(minYear, 0, 1);
    const monthEnd = new Date(maxYear, 11, 31, 23, 59, 59, 999);
    const months: MonthView[] = [];
    let cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const start = startOfMonth(cursor);
      const end = endOfMonth(cursor);
      const weeks = buildMonthWeeks(start, end);
      const rows: RowView[] = buildRows(items, weeks, groups);
      const monthSegments = [{ label: monthLabel(start), span: weeks.length, startIndex: 0, date: start }];
      months.push({
        label: monthLabel(start),
        weeks,
        rows,
        headerLabel: "Item / Semana",
        startDate: start,
        monthSegments,
        cellMinWidth: 42,
      });
      cursor = addMonths(cursor, 1);
    }
    return months;
  }

  if (granularity === "quarter") {
    const quarters: MonthView[] = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      for (let q = 0; q < 4; q += 1) {
        const start = new Date(year, q * 3, 1);
        const end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
        const weeks = buildWeeks(start, end, { labelStyle: "range" });
        const rows: RowView[] = buildRows(items, weeks, groups);
        const monthSegments = buildMonthSegments(weeks, {
          includeYearOnFirst: true,
          includeYearOnChange: true,
          labelStyle: "short",
        });
        quarters.push({
          label: `Q${q + 1} ${year}`,
          weeks,
          rows,
          headerLabel: "Item / Semana",
          startDate: start,
          monthSegments,
          cellMinWidth: 30,
        });
      }
    }
    return quarters;
  }

  const years: MonthView[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const weeks = buildYearWeeks(start, end);
    const rows: RowView[] = buildRows(items, weeks, groups);
    const monthSegments = buildMonthSegments(weeks, { labelStyle: "short" });
    years.push({
      label: `${year}`,
      weeks,
      rows,
      headerLabel: "Item / Semana",
      startDate: start,
      monthSegments,
      cellMinWidth: 24,
    });
  }
  return years;
}

function buildRows(
  items: NormalizedItem[],
  weeks: WeekSlot[],
  groups?: { id: string; label: string }[]
): RowView[] {
  if (!groups || groups.length === 0) {
    return items.map((item) => buildRow(item, weeks));
  }

  const groupMap = new Map<string, NormalizedItem[]>();
  items.forEach((item) => {
    const gid = item.group || "unknown";
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(item);
  });

  const rows: RowView[] = [];
  groups.forEach((group) => {
    const groupItems = groupMap.get(group.id) || [];
    if (groupItems.length === 0) return;
    rows.push({
      id: `header-${group.id}`,
      label: group.label.toLocaleUpperCase(),
      color: "transparent",
      cells: weeks.map(() => ({ active: false })),
      isHeader: true,
    });
    groupItems.forEach((item) => rows.push(buildRow(item, weeks)));
  });
  return rows;
}

function buildRow(item: NormalizedItem, weeks: WeekSlot[]): RowView {
  const color = pickColor(item);
  const progressPct = item.progress_pct;
  const status = item.status;
  const cells = weeks.map((w) => {
    const active = item.startDate && item.endDate ? rangesOverlap(w.start, w.end, item.startDate, item.endDate) : false;
    return { active };
  });
  return {
    id: item.id,
    label: truncate(item.label || "Sin nombre", 50),
    color,
    status,
    progressPct,
    startDate: item.startDate,
    endDate: item.endDate,
    isOverdue: item.is_overdue,
    cells,
  };
}

function MonthGrid({
  views,
  maxHeight,
  focus,
  pinned,
  onFocusChange,
  onPinChange,
}: {
  views: MonthView[];
  maxHeight?: number | string;
  focus: FocusPayload | null;
  pinned: FocusPayload | null;
  onFocusChange: (payload: FocusPayload | null) => void;
  onPinChange: (payload: FocusPayload | null) => void;
}) {
  const containerStyle = maxHeight ? { maxHeight } : undefined;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const [hoveredRow, setHoveredRow] = useState<{ viewLabel: string; rowId: string } | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<{ viewLabel: string; weekIndex: number } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const leftMinWidth = 200;
  const leftMaxWidth = 460;
  const leftDefaultWidth = 260;
  const minGridWidth = 240;
  const [leftWidth, setLeftWidth] = useState(leftDefaultWidth);
  const resizingRef = useRef<{ startX: number; startWidth: number; maxWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const getMaxLeftWidth = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return leftMaxWidth;
    const maxByContainer = wrapper.clientWidth - minGridWidth;
    return Math.max(leftMinWidth, Math.min(leftMaxWidth, maxByContainer));
  };

  const clampLeftWidth = (value: number, maxWidth: number) => {
    return Math.max(leftMinWidth, Math.min(maxWidth, value));
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const maxWidth = getMaxLeftWidth();
    resizingRef.current = { startX: event.clientX, startWidth: leftWidth, maxWidth };
    setIsResizing(true);
    event.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const buildTooltip = (
    target: HTMLElement,
    payload: FocusPayload,
    mode: TooltipState["mode"]
  ): TooltipState | null => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = target.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const styles = window.getComputedStyle(wrapper);
    const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
    const paddingTop = Number.parseFloat(styles.paddingTop || "0");
    const x = rect.left - wrapperRect.left - paddingLeft + rect.width / 2;
    const topWithin = rect.top - wrapperRect.top - paddingTop + wrapper.scrollTop;
    const placeTop = rect.top - wrapperRect.top > 140;
    const y = placeTop ? topWithin : topWithin + rect.height;
    return { payload, x, y, placement: placeTop ? "top" : "bottom", mode };
  };

  const showTooltip = (target: HTMLElement, payload: FocusPayload, mode: TooltipState["mode"]) => {
    const next = buildTooltip(target, payload, mode);
    if (!next) return;
    anchorRef.current = target;
    setTooltip(next);
  };

  const refreshTooltip = () => {
    setTooltip((current) => {
      if (!current || !anchorRef.current) return current;
      const next = buildTooltip(anchorRef.current, current.payload, current.mode);
      return next || current;
    });
  };

  const clearHover = () => {
    setHoveredRow(null);
    setHoveredWeek(null);
    onFocusChange(null);
    setTooltip((current) => (current?.mode === "pinned" ? current : null));
  };

  const handleScroll = () => {
    if (tooltip?.mode === "pinned") {
      refreshTooltip();
      return;
    }
    setTooltip(null);
  };

  useEffect(() => {
    if (!pinned) {
      setTooltip((current) => (current?.mode === "pinned" ? null : current));
    }
  }, [pinned]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      const { startX, startWidth, maxWidth } = resizingRef.current;
      const delta = event.clientX - startX;
      const nextWidth = clampLeftWidth(startWidth + delta, maxWidth);
      setLeftWidth(Math.round(nextWidth));
    };
    const handleUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const maxWidth = getMaxLeftWidth();
      setLeftWidth((prev) => clampLeftWidth(prev, maxWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="timeline-grid-wrapper px-3 py-2 space-y-4 overflow-x-hidden overflow-y-auto scrollbar-thin w-full max-w-full pdf-expand"
      style={containerStyle}
      onMouseLeave={clearHover}
      onScroll={handleScroll}
    >
      {views.map((view) => {
        const headerRowHeight = 24;
        const rowHeight = 72;
        const rowTemplate = `${headerRowHeight}px ${headerRowHeight}px repeat(${view.rows.length}, ${rowHeight}px)`;
        const boardTemplate = `${leftWidth}px 10px repeat(${view.weeks.length}, minmax(0, 1fr))`;
        const weekStartColumn = 3;
        const rowStartIndex = 3;
        return (
          <div key={view.label} className="timeline-view space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">
                {view.rows.filter((row) => !row.isHeader).length} elementos
              </div>
            </div>
            <div className="timeline-grid-scroll overflow-visible w-full pdf-expand-x" onScroll={handleScroll}>
              <div className="timeline-grid-header-bg" aria-hidden="true" />
              <div
                className="grid timeline-board gap-x-1.5 gap-y-2"
                style={{
                  gridTemplateColumns: boardTemplate,
                  gridTemplateRows: rowTemplate,
                }}
              >
                <div className="timeline-left-header timeline-left-track" style={{ gridColumn: "1", gridRow: "1" }} />
                <div className="timeline-left-header timeline-left-track" style={{ gridColumn: "1", gridRow: "2" }}>
                  {view.headerLabel}
                </div>
                <div
                  className={`timeline-resizer ${isResizing ? "is-active" : ""}`}
                  style={{ gridColumn: "2", gridRow: "1 / -1", left: leftWidth }}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Ajustar ancho de items"
                  aria-valuenow={Math.round(leftWidth)}
                  aria-valuemin={leftMinWidth}
                  aria-valuemax={Math.round(getMaxLeftWidth())}
                  onPointerDown={startResize}
                  onDoubleClick={() => setLeftWidth(leftDefaultWidth)}
                />

                {view.monthSegments.map((segment) => (
                  <div
                    key={`${segment.label}-${segment.startIndex}`}
                    className="timeline-month-segment"
                    style={{
                      gridColumn: `${segment.startIndex + weekStartColumn} / span ${segment.span}`,
                      gridRow: "1",
                    }}
                  >
                    {segment.label}
                  </div>
                ))}

                {view.weeks.map((w, idx) => {
                  const isMonthStart = view.monthSegments.some((segment) => segment.startIndex === idx);
                  const weekPinned = !!pinned && pinned.viewLabel === view.label && pinned.weekIndex === idx;
                  const weekHovered = !!hoveredWeek && hoveredWeek.viewLabel === view.label && hoveredWeek.weekIndex === idx;
                  const weekActive = weekPinned || weekHovered;
                  return (
                    <div
                      key={`${w.label}-${w.start.toISOString()}`}
                      className={`timeline-week ${w.isCurrent ? "is-current" : ""} ${weekActive ? "is-hover" : ""} ${
                        isMonthStart ? "is-start" : ""
                      }`}
                      style={{ gridColumn: `${idx + weekStartColumn}`, gridRow: "2" }}
                      onMouseEnter={() => {
                        setHoveredWeek({ viewLabel: view.label, weekIndex: idx });
                        onFocusChange(null);
                        setTooltip((current) => (current?.mode === "pinned" ? current : null));
                      }}
                    >
                      {w.label}
                    </div>
                  );
                })}

                {view.rows.map((row, rowIndex) => {
                  const gridRow = `${rowIndex + rowStartIndex}`;
                  const stripe = rowIndex % 2 === 0;
                  const rowPinned = row.isHeader
                    ? false
                    : !!pinned && pinned.viewLabel === view.label && pinned.rowId === row.id;
                  const rowHovered = row.isHeader
                    ? false
                    : !!hoveredRow && hoveredRow.viewLabel === view.label && hoveredRow.rowId === row.id;
                  const rowActive = rowPinned || rowHovered;

                  if (row.isHeader) {
                    return [
                      <div
                        key={row.id}
                        className="timeline-row timeline-row--group timeline-left-track"
                        style={{ gridColumn: "1", gridRow }}
                      >
                        {row.label}
                      </div>,
                      <div
                        key={`${row.id}-spacer`}
                        className="timeline-row-spacer"
                        style={{
                          gridColumn: `${weekStartColumn} / span ${view.weeks.length}`,
                          gridRow,
                        }}
                      />,
                    ];
                  }

                  const leftCard = (
                    <div
                      key={row.id}
                      className={`timeline-row timeline-left-track ${stripe ? "is-striped" : ""} ${
                        rowActive ? "is-active" : ""
                      } ${rowPinned ? "is-pinned" : ""}`}
                      style={{ gridColumn: "1", gridRow, borderLeftColor: row.color }}
                      onMouseEnter={() => {
                        setHoveredRow({ viewLabel: view.label, rowId: row.id });
                        setHoveredWeek(null);
                        onFocusChange(null);
                        setTooltip((current) => (current?.mode === "pinned" ? current : null));
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="timeline-row-dot" style={{ backgroundColor: row.color }} />
                        <span className="truncate">{row.label}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-secondary">
                        {row.status && <span>{row.status}</span>}
                        {row.status && typeof row.progressPct === "number" && <span>·</span>}
                        {typeof row.progressPct === "number" && <span>{row.progressPct}%</span>}
                        {row.isOverdue && (
                          <>
                            {(row.status || typeof row.progressPct === "number") && <span>·</span>}
                            <span className="timeline-row-pill timeline-row-pill--danger">Vencida</span>
                          </>
                        )}
                      </div>
                    </div>
                  );

                  const weekCells = row.cells.map((cell, idx) => {
                    const week = view.weeks[idx];
                    const isMonthStart = view.monthSegments.some((segment) => segment.startIndex === idx);
                    const baseTitle = `Semana ${week ? weekRangeLabel(week.start, week.end) : ""} · ${row.label}`;
                    const detailTitle = [
                      baseTitle,
                      typeof row.progressPct === "number" ? `Avance ${row.progressPct}%` : "",
                      row.status ? `Estado ${row.status}` : "",
                      row.isOverdue ? "Vencida" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const weekPinned = !!pinned && pinned.viewLabel === view.label && pinned.weekIndex === idx;
                    const weekHovered = !!hoveredWeek && hoveredWeek.viewLabel === view.label && hoveredWeek.weekIndex === idx;
                    const weekActive = weekPinned || weekHovered;
                    const isPinnedCell = isSameFocus(pinned, view.label, row.id, idx);
                    const isFocusedCell = isSameFocus(focus, view.label, row.id, idx);
                    const isInteractive = cell.active;
                    const allowTooltip = !pinned || isPinnedCell;
                    const cellStyle = cell.active
                      ? {
                          backgroundColor: applyAlpha(row.color, 0.35),
                          borderColor: applyAlpha(row.color, 0.65),
                        }
                      : undefined;
                    const cellClassName = `timeline-cell ${cell.active ? "is-active" : "is-idle"} ${
                      weekActive ? "is-week" : ""
                    } ${rowActive ? "is-row" : ""} ${week?.isCurrent ? "is-current" : ""} ${
                      isMonthStart ? "is-start" : ""
                    } ${isFocusedCell ? "is-focused" : ""} ${isPinnedCell ? "is-pinned" : ""}`;

                    if (!isInteractive) {
                      return (
                        <div
                          key={`${row.id}-${idx}`}
                          className={cellClassName}
                          style={{ ...cellStyle, gridColumn: `${idx + weekStartColumn}`, gridRow }}
                          aria-hidden="true"
                          onMouseEnter={() => {
                            if (!week) return;
                            onFocusChange(null);
                            setHoveredRow({ viewLabel: view.label, rowId: row.id });
                            setHoveredWeek({ viewLabel: view.label, weekIndex: idx });
                            setTooltip((current) => (current?.mode === "pinned" ? current : null));
                          }}
                        />
                      );
                    }

                    return (
                      <button
                        key={`${row.id}-${idx}`}
                        type="button"
                        className={cellClassName}
                        style={{ ...cellStyle, gridColumn: `${idx + weekStartColumn}`, gridRow }}
                        aria-label={detailTitle}
                        aria-pressed={isPinnedCell}
                        onMouseEnter={(event) => {
                          if (!week) return;
                          const payload = buildFocusPayload(view, row, week, idx);
                          onFocusChange(payload);
                          setHoveredRow({ viewLabel: view.label, rowId: row.id });
                          setHoveredWeek({ viewLabel: view.label, weekIndex: idx });
                          if (allowTooltip) {
                            showTooltip(event.currentTarget, payload, pinned ? "pinned" : "hover");
                          }
                        }}
                        onFocus={(event) => {
                          if (!week) return;
                          const payload = buildFocusPayload(view, row, week, idx);
                          onFocusChange(payload);
                          setHoveredRow({ viewLabel: view.label, rowId: row.id });
                          setHoveredWeek({ viewLabel: view.label, weekIndex: idx });
                          if (allowTooltip) {
                            showTooltip(event.currentTarget, payload, pinned ? "pinned" : "hover");
                          }
                        }}
                        onClick={(event) => {
                          if (!week) return;
                          const payload = buildFocusPayload(view, row, week, idx);
                          if (isPinnedCell) {
                            onPinChange(null);
                            setTooltip(null);
                            return;
                          }
                          onPinChange(payload);
                          showTooltip(event.currentTarget, payload, "pinned");
                        }}
                      />
                    );
                  });

                  return [leftCard, ...weekCells];
                })}
              </div>
            </div>
          </div>
        );
      })}
      {tooltip && (
        <div
          className={`timeline-tooltip ${tooltip.placement === "bottom" ? "is-bottom" : ""}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <TooltipCard payload={tooltip.payload} pinned={tooltip.mode === "pinned"} />
        </div>
      )}
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="timeline-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`timeline-segment ${value === option.value ? "is-active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SummaryChip({
  value,
  label,
  tone = "neutral",
}: {
  value: string | number;
  label: string;
  tone?: "neutral" | "accent" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "timeline-chip timeline-chip--danger" : tone === "accent" ? "timeline-chip timeline-chip--accent" : "timeline-chip";
  return (
    <div className={toneClass}>
      <span className="timeline-chip-value">{value}</span>
      <span className="timeline-chip-label">{label}</span>
    </div>
  );
}

function TooltipCard({ payload, pinned }: { payload: FocusPayload; pinned: boolean }) {
  const rangeLabel = payload.itemRange ? `Fechas ${payload.itemRange}` : "Sin fechas definidas";
  return (
    <div className="timeline-focus">
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payload.color }} />
        <span className="text-xs font-semibold truncate">{payload.rowLabel}</span>
        {pinned && <span className="timeline-focus-pill">Fijado</span>}
      </div>
      <div className="text-[11px] text-secondary">
        {payload.viewLabel} · Semana {payload.weekRange} · {rangeLabel}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {payload.status && (
          <span className="timeline-focus-badge" style={{ borderColor: payload.color }}>
            {payload.status}
          </span>
        )}
        {typeof payload.progressPct === "number" && (
          <span className="timeline-focus-badge">Avance {payload.progressPct}%</span>
        )}
        {payload.isOverdue && <span className="timeline-focus-badge timeline-focus-badge--danger">Vencida</span>}
        {payload.isCurrentWeek && <span className="timeline-focus-badge">Semana actual</span>}
      </div>
    </div>
  );
}

function isSameFocus(focus: FocusPayload | null, viewLabel: string, rowId: string, weekIndex: number) {
  return !!focus && focus.viewLabel === viewLabel && focus.rowId === rowId && focus.weekIndex === weekIndex;
}

function buildFocusPayload(view: MonthView, row: RowView, week: WeekSlot, weekIndex: number): FocusPayload {
  return {
    viewLabel: view.label,
    rowId: row.id,
    rowLabel: row.label,
    status: row.status,
    progressPct: row.progressPct,
    color: row.color,
    weekIndex,
    weekLabel: week.label,
    weekRange: weekRangeLabel(week.start, week.end),
    itemRange: formatDateRange(row.startDate, row.endDate),
    isOverdue: row.isOverdue,
    isCurrentWeek: week.isCurrent,
  };
}

function formatDateShort(date: Date, includeYear?: boolean) {
  const label = date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  if (includeYear) {
    return `${label} ${date.getFullYear()}`;
  }
  return label;
}

function formatDateRange(start?: Date, end?: Date) {
  if (!start && !end) return undefined;
  const safeStart = start ?? end!;
  const safeEnd = end ?? start!;
  if (safeStart.toDateString() === safeEnd.toDateString()) {
    return formatDateShort(safeStart, true);
  }
  const sameYear = safeStart.getFullYear() === safeEnd.getFullYear();
  const startLabel = formatDateShort(safeStart);
  const endLabel = formatDateShort(safeEnd);
  if (sameYear) {
    return `${startLabel} - ${endLabel} ${safeStart.getFullYear()}`;
  }
  return `${startLabel} ${safeStart.getFullYear()} - ${endLabel} ${safeEnd.getFullYear()}`;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

function buildWeeks(
  start: Date,
  end: Date,
  options?: { maxWeeks?: number; labelPrefix?: string; labelStyle?: "range" | "index" | "day" }
): WeekSlot[] {
  const weeks: WeekSlot[] = [];
  let cursor = startOfWeek(start);
  const currentWeekStart = startOfWeek(new Date());
  while (cursor <= end) {
    const wStart = new Date(cursor);
    const wEnd = endOfWeek(cursor);
    const isCurrent = startOfWeek(wStart).getTime() === currentWeekStart.getTime();
    weeks.push({ start: wStart, end: wEnd, label: weekLabel(wStart), isCurrent });
    cursor = addDays(wStart, 7);
  }
  const trimmed = options?.maxWeeks ? weeks.slice(0, options.maxWeeks) : weeks;
  if (options?.labelStyle === "index") {
    return trimmed.map((w, idx) => ({
      ...w,
      label: `${options.labelPrefix ? `${options.labelPrefix} ` : ""}W${idx + 1}`,
    }));
  }
  if (options?.labelStyle === "range") {
    return trimmed.map((w) => ({
      ...w,
      label: `${options.labelPrefix ? `${options.labelPrefix} ` : ""}${weekRangeLabel(w.start, w.end)}`,
    }));
  }
  if (options?.labelStyle === "day") {
    return trimmed.map((w) => ({
      ...w,
      label: `${options.labelPrefix ? `${options.labelPrefix} ` : ""}${weekTickLabel(w.start)}`,
    }));
  }
  if (options?.labelPrefix) {
    return trimmed.map((w) => ({ ...w, label: `${options.labelPrefix} ${w.label}` }));
  }
  return trimmed;
}

function buildMonthWeeks(start: Date, end: Date) {
  return buildWeeks(start, end, { maxWeeks: 4, labelStyle: "range" });
}

function buildYearWeeks(start: Date, end: Date) {
  const weeks: WeekSlot[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    weeks.push(...buildWeeks(monthStart, monthEnd, { maxWeeks: 4, labelStyle: "range" }));
    cursor = addMonths(cursor, 1);
  }
  return buildBiWeeks(weeks);
}

function findInitialIndex(views: MonthView[], granularity: "month" | "quarter" | "year") {
  const today = new Date();
  const index = views.findIndex((view) => {
    const start = view.startDate;
    const end =
      granularity === "month"
        ? endOfMonth(start)
        : granularity === "quarter"
        ? endOfQuarter(start)
        : new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
    return today >= start && today <= end;
  });
  if (index >= 0) return index;
  if (today < views[0].startDate) return 0;
  return views.length - 1;
}

function pickColor(item: TimelineItem): string {
  const status = (item.status || "").toLowerCase();
  const overdue = !!item.is_overdue;
  const isActive = ["curso", "progreso", "sin empezar", "pendiente"].some((s) => status.includes(s));
  if (overdue && isActive) return "#dc2626";
  if (["listo", "cerrado", "done", "completo", "completado"].some((s) => status.includes(s))) return "#16a34a";
  if (["revisión", "revision"].some((s) => status.includes(s))) return "#f97316";
  if (["curso", "progreso"].some((s) => status.includes(s))) return "#2563eb";
  if (["sin empezar", "pendiente"].some((s) => status.includes(s))) return "#9ca3af";
  return "#6b7280";
}

function applyAlpha(color: string, alpha: number) {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1);
  const normalized =
    hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  if (normalized.length !== 6) return color;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function endOfQuarter(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday
  const diff = (day === 0 ? -6 : 1) - day; // start Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = new Date(startOfWeek(date));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth}-${endDay} ${endMonth}`;
}

function weekRangeLabel(start: Date, end: Date) {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = `${start.getMonth() + 1}`.padStart(2, "0");
  const endMonth = `${end.getMonth() + 1}`.padStart(2, "0");
  return `${startDay}/${startMonth}-${endDay}/${endMonth}`;
}

function weekTickLabel(start: Date) {
  const month = `${start.getMonth() + 1}`.padStart(2, "0");
  return `${start.getDate()}/${month}`;
}

function monthLabel(date: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
  return date.toLocaleDateString(undefined, opts);
}

function monthNameLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long" });
}

function formatMonthSegmentLabel(date: Date, style: "long" | "short" | "narrow", includeYear: boolean) {
  if (style === "long") {
    return includeYear ? monthLabel(date) : monthNameLabel(date);
  }
  const opts: Intl.DateTimeFormatOptions = { month: style === "narrow" ? "narrow" : "short" };
  if (includeYear) {
    opts.year = "numeric";
  }
  let label = date.toLocaleDateString(undefined, opts);
  label = label.replace(/\./g, "").replace(/\s+de\s+/gi, " ").trim();
  return label;
}

function buildMonthSegments(
  weeks: WeekSlot[],
  options?: { includeYearOnFirst?: boolean; includeYearOnChange?: boolean; labelStyle?: "long" | "short" | "narrow" }
): MonthSegment[] {
  const segments: MonthSegment[] = [];
  weeks.forEach((week, idx) => {
    const monthDate = week.start;
    const last = segments[segments.length - 1];
    const isNewMonth =
      !last ||
      last.date.getMonth() !== monthDate.getMonth() ||
      last.date.getFullYear() !== monthDate.getFullYear();
    if (!isNewMonth) {
      last.span += 1;
      return;
    }
    const includeYear =
      (options?.includeYearOnFirst && segments.length === 0) ||
      (!!options?.includeYearOnChange && !!last && last.date.getFullYear() !== monthDate.getFullYear());
    const label = formatMonthSegmentLabel(monthDate, options?.labelStyle ?? "long", includeYear);
    segments.push({ label, span: 1, startIndex: idx, date: monthDate });
  });
  return segments;
}

function buildBiWeeks(weeks: WeekSlot[]): WeekSlot[] {
  const biweeks: WeekSlot[] = [];
  for (let i = 0; i < weeks.length; i += 2) {
    const first = weeks[i];
    const second = weeks[i + 1];
    if (!second) {
      biweeks.push(first);
      break;
    }
    const start = first.start;
    const end = second.end;
    biweeks.push({
      start,
      end,
      label: weekRangeLabel(start, end),
      isCurrent: !!(first.isCurrent || second.isCurrent),
    });
  }
  return biweeks;
}
