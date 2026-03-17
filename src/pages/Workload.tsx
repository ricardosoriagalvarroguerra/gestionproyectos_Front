import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AuthUser, WorkloadCell, WorkloadOverviewResponse, WorkloadUserRow } from "../api/client";
import { normalizeText } from "../utils/display";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const AREA_GROUPS: { key: string; label: string; members: string[] }[] = [
  { key: "pfa", label: "PFA", members: ["juan carlos hurtado", "javier glejberman"] },
  { key: "grf", label: "GRF", members: ["carolina britos", "rodrigo sarachaga"] },
  { key: "ubo", label: "UBO", members: ["gabriel paredes", "gabriela rocha", "helga niesser", "pablo hermosa"] },
  { key: "vp", label: "VP", members: ["ricardo soria galvarro", "rafael robles", "matias mednik", "alvaro miranda"] },
];

function groupUsersByArea(users: WorkloadUserRow[]) {
  const grouped: { key: string; label: string; users: WorkloadUserRow[] }[] = [];
  const assigned = new Set<string>();

  for (const area of AREA_GROUPS) {
    const areaUsers = users.filter((u) => area.members.includes(u.user_key.toLowerCase()));
    if (areaUsers.length > 0) {
      grouped.push({ key: area.key, label: area.label, users: areaUsers });
      areaUsers.forEach((u) => assigned.add(u.user_key));
    }
  }

  const unassigned = users.filter((u) => !assigned.has(u.user_key));
  if (unassigned.length > 0) {
    grouped.push({ key: "otros", label: "Otros", users: unassigned });
  }

  return grouped;
}

export function Workload({ currentUser }: { currentUser: AuthUser | null }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [onlyLoginUsers, setOnlyLoginUsers] = useState(true);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);
  const [profileUserKey, setProfileUserKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    placement: "top" | "bottom";
    userName: string;
    weekLabel: string;
    rangeLabel: string;
    cell: WorkloadCell;
  } | null>(null);

  const workloadQuery = useQuery<WorkloadOverviewResponse>({
    queryKey: ["workload", year, month],
    queryFn: () => api.workload(year, month),
    enabled: !!currentUser?.can_view_workload,
  });

  const filteredUsers = useMemo(() => {
    const rows = workloadQuery.data?.users || [];
    const term = normalizeText(search);
    return rows.filter((row) => {
      if (onlyLoginUsers && !row.can_login) return false;
      if (!term) return true;
      return normalizeText(row.display_name).includes(term);
    });
  }, [onlyLoginUsers, search, workloadQuery.data?.users]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserKey(null);
      setProfileUserKey(null);
      return;
    }
    if (selectedUserKey && filteredUsers.some((user) => user.user_key === selectedUserKey)) {
      return;
    }
    setSelectedUserKey(getPreferredUser(filteredUsers, currentUser?.user_key)?.user_key ?? filteredUsers[0]?.user_key ?? null);
  }, [currentUser?.user_key, filteredUsers, selectedUserKey]);

  useEffect(() => {
    if (profileUserKey && !filteredUsers.some((user) => user.user_key === profileUserKey)) {
      setProfileUserKey(null);
    }
  }, [filteredUsers, profileUserKey]);

  useEffect(() => {
    if (!profileUserKey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileUserKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileUserKey]);

  const areaGroups = useMemo(() => groupUsersByArea(filteredUsers), [filteredUsers]);

  const toggleArea = (areaKey: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaKey)) next.delete(areaKey);
      else next.add(areaKey);
      return next;
    });
  };

  const totalMax = useMemo(() => {
    const values = filteredUsers.flatMap((row) => row.weeks.map((cell) => cell.total));
    return Math.max(1, ...values, 1);
  }, [filteredUsers]);

  const profileUser = useMemo(
    () => filteredUsers.find((user) => user.user_key === profileUserKey) ?? null,
    [filteredUsers, profileUserKey]
  );

  const weeksData = workloadQuery.data?.weeks || [];

  return (
    <div className="min-h-full space-y-4 sm:space-y-5">
      {/* Header */}
      <section className="glass overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <p className="wl-overline">Cronograma ejecutivo</p>
        <h1 className="wl-title">Carga semanal por usuario</h1>
        <div className="wl-toolbar">
          <div className="wl-toolbar-group">
            <label className="wl-filter-label">
              Mes
              <select className="wl-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="wl-filter-label">
              Año
              <select className="wl-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, index) => today.getFullYear() - 1 + index).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <input
            className="wl-search"
            placeholder="Filtrar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      {/* Grid */}
      <section className="glass relative overflow-hidden">
        <div className="wl-grid-header">
          <div>
            <span className="wl-grid-title">{workloadQuery.data?.label || "Sin periodo"}</span>
            <span className="wl-grid-count">{filteredUsers.length} usuarios</span>
          </div>
        </div>

        {workloadQuery.isLoading ? (
          <div className="wl-empty">Cargando...</div>
        ) : workloadQuery.isError ? (
          <div className="wl-empty wl-empty--error">No se pudo cargar el cronograma de carga.</div>
        ) : (
          <div className="wl-scroll">
            <table className="wl-table">
              <thead>
                <tr>
                  <th className="wl-th wl-th--user">Usuario</th>
                  {weeksData.map((week) => (
                    <th key={week.id} className="wl-th wl-th--week">
                      <span className="wl-th-week">{week.label}</span>
                      <span className="wl-th-range">{week.range_label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areaGroups.map((area) => {
                  const isCollapsed = collapsedAreas.has(area.key);
                  return (
                    <Fragment key={area.key}>
                      <tr className="wl-area-row" onClick={() => toggleArea(area.key)}>
                        <td className="wl-td wl-td--area" colSpan={weeksData.length + 1}>
                          <span className={`wl-area-toggle ${isCollapsed ? "is-collapsed" : ""}`}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M3 2l4 3-4 3z" />
                            </svg>
                          </span>
                          <span className="wl-area-label">{area.label}</span>
                          <span className="wl-area-count">{area.users.length}</span>
                        </td>
                      </tr>
                      {!isCollapsed && area.users.map((user) => {
                        const isSelected = selectedUserKey === user.user_key;
                        const initials = user.display_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                        return (
                          <tr key={user.user_key} className={`wl-row ${isSelected ? "is-selected" : ""}`}>
                            <td className="wl-td wl-td--user">
                              <button
                                type="button"
                                className="wl-user-btn"
                                onClick={() => { setSelectedUserKey(user.user_key); setProfileUserKey(user.user_key); }}
                              >
                                <span className="wl-avatar-sm">{initials}</span>
                                <span className="wl-user-info">
                                  <span className="wl-user-name">{user.display_name}</span>
                                </span>
                              </button>
                            </td>
                            {user.weeks.map((cell) => {
                              const intensity = cell.total > 0 ? Math.max(0.10, cell.total / totalMax) : 0;
                              const isHigh = cell.total / totalMax > 0.7;
                              return (
                                <td key={cell.week_id} className="wl-td wl-td--cell">
                                  <div
                                    className={`wl-cell ${cell.total > 0 ? "is-active" : "is-empty"} ${isHigh ? "is-high" : ""}`}
                                    onMouseEnter={(event) =>
                                      setTooltip(buildTooltipState(event, user.display_name, cell, weeksData))
                                    }
                                    onMouseMove={(event) =>
                                      setTooltip(buildTooltipState(event, user.display_name, cell, weeksData))
                                    }
                                    onMouseLeave={() => setTooltip(null)}
                                    style={cell.total > 0 ? {
                                      background: `rgba(35, 131, 226, ${intensity})`,
                                      borderColor: `rgba(35, 131, 226, ${Math.min(0.4, intensity + 0.12)})`,
                                    } : undefined}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="wl-empty">No hay usuarios para el filtro actual.</div>
            )}
          </div>
        )}
        {tooltip && (
          <div
            className={`timeline-tooltip ${tooltip.placement === "bottom" ? "is-bottom" : ""}`}
            style={{ position: "fixed", left: tooltip.x, top: tooltip.y }}
          >
            <WorkloadTooltipCard tooltip={tooltip} />
          </div>
        )}
      </section>

      {profileUser && (
        <WorkloadProfileModal
          user={profileUser}
          weeks={weeksData}
          onClose={() => setProfileUserKey(null)}
        />
      )}
    </div>
  );
}

function buildTooltipState(
  event: React.MouseEvent<HTMLDivElement>,
  userName: string,
  cell: WorkloadCell,
  weeks: WorkloadOverviewResponse["weeks"]
) {
  const week = weeks.find((item) => item.id === cell.week_id);
  const viewportHeight = window.innerHeight || 0;
  return {
    x: event.clientX,
    y: event.clientY,
    placement: event.clientY < viewportHeight * 0.35 ? "bottom" : "top",
    userName,
    weekLabel: week?.label || "Semana",
    rangeLabel: week?.range_label || "",
    cell,
  } as const;
}

function getPreferredUser(users: WorkloadUserRow[], currentUserKey?: string | null) {
  if (currentUserKey) {
    const current = users.find((user) => user.user_key === currentUserKey);
    if (current) return current;
  }
  return users[0] ?? null;
}

function summarizeUserWorkload(user: WorkloadUserRow, weeks: WorkloadOverviewResponse["weeks"]) {
  const uniqueProjects = new Set<string>();
  const uniqueProducts = new Set<string>();
  const uniqueTasks = new Set<string>();
  const projectFrequency = new Map<string, number>();
  const productFrequency = new Map<string, number>();
  const taskFrequency = new Map<string, number>();
  let activeWeeks = 0;
  let maxWeeklyLoad = 0;
  let busiestWeekLabel = "";

  user.weeks.forEach((cell, index) => {
    if (cell.total > 0) {
      activeWeeks += 1;
    }
    if (cell.total > maxWeeklyLoad) {
      maxWeeklyLoad = cell.total;
      busiestWeekLabel = weeks[index]?.label || cell.week_id;
    }
    cell.project_names.forEach((item) => uniqueProjects.add(item));
    cell.product_names.forEach((item) => uniqueProducts.add(item));
    cell.task_names.forEach((item) => uniqueTasks.add(item));
    incrementItems(projectFrequency, cell.project_names);
    incrementItems(productFrequency, cell.product_names);
    incrementItems(taskFrequency, cell.task_names);
  });

  return {
    activeWeeks,
    maxWeeklyLoad,
    busiestWeekLabel,
    uniqueProjects: [...uniqueProjects].sort((left, right) => left.localeCompare(right)),
    uniqueProducts: [...uniqueProducts].sort((left, right) => left.localeCompare(right)),
    uniqueTasks: [...uniqueTasks].sort((left, right) => left.localeCompare(right)),
    topProjects: getTopItems(projectFrequency),
    topProducts: getTopItems(productFrequency),
    topTasks: getTopItems(taskFrequency),
  };
}

function incrementItems(counter: Map<string, number>, items: string[]) {
  items.forEach((item) => counter.set(item, (counter.get(item) ?? 0) + 1));
}

function getTopItems(counter: Map<string, number>, limit = 3) {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function WorkloadProfileModal({
  user,
  weeks,
  onClose,
}: {
  user: WorkloadUserRow;
  weeks: WorkloadOverviewResponse["weeks"];
  onClose: () => void;
}) {
  const summary = useMemo(() => summarizeUserWorkload(user, weeks), [user, weeks]);
  const initials = user.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="wpm-backdrop" onClick={onClose}>
      <div
        className="wpm-page"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Resumen de carga de ${user.display_name}`}
      >
        {/* Cover band */}
        <div className="wpm-cover">
          <button type="button" className="wpm-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1 1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Avatar overlapping the cover */}
        <div className="wpm-avatar-row">
          <div className="wpm-avatar">{initials}</div>
        </div>

        {/* Content */}
        <div className="wpm-content">
          <h2 className="wpm-name">{user.display_name}</h2>
          <div className="wpm-meta">
            <span className={`wpm-tag ${user.can_login ? "is-green" : ""}`}>
              {user.can_login ? "Login habilitado" : "Usuario interno"}
            </span>
            {summary.busiestWeekLabel ? (
              <span className="wpm-tag is-blue">
                Pico {summary.busiestWeekLabel}: {summary.maxWeeklyLoad}
              </span>
            ) : (
              <span className="wpm-tag">Sin carga en el mes</span>
            )}
            <span className="wpm-tag">{summary.activeWeeks} de {weeks.length} semanas activas</span>
          </div>

          {/* Stats row */}
          <div className="wpm-stats-row">
            <WpmStat label="Proyectos" value={summary.uniqueProjects.length} tone="project" />
            <WpmStat label="Productos" value={summary.uniqueProducts.length} tone="product" />
            <WpmStat label="Tareas" value={summary.uniqueTasks.length} tone="task" />
          </div>

          <div className="wpm-divider" />

          {/* Chart section */}
          <div className="wpm-section">
            <h3 className="wpm-section-title">Distribucion semanal</h3>
            <div className="wpm-legend">
              <WpmLegendDot label="Proyecto" tone="project" />
              <WpmLegendDot label="Producto" tone="product" />
              <WpmLegendDot label="Tarea" tone="task" />
            </div>
            <div className="wpm-chart">
              {weeks.map((week, index) => {
                const cell = user.weeks[index];
                if (!cell) return null;
                const pct = summary.maxWeeklyLoad > 0 ? cell.total / summary.maxWeeklyLoad : 0;
                const barH = Math.max(6, pct * 100);
                return (
                  <div key={week.id} className="wpm-chart-col">
                    <div className="wpm-chart-bar-area">
                      <div
                        className={`wpm-chart-bar ${cell.total > 0 ? "is-active" : ""}`}
                        style={{ height: `${barH}%` }}
                      >
                        {cell.projects > 0 && <div className="wpm-seg is-project" style={{ flexGrow: cell.projects }} />}
                        {cell.products > 0 && <div className="wpm-seg is-product" style={{ flexGrow: cell.products }} />}
                        {cell.tasks > 0 && <div className="wpm-seg is-task" style={{ flexGrow: cell.tasks }} />}
                      </div>
                    </div>
                    <span className="wpm-chart-val">{cell.total}</span>
                    <span className="wpm-chart-label">{week.label.replace("Sem ", "S")}</span>
                    <span className="wpm-chart-sub">{week.range_label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wpm-divider" />

          {/* Focus section */}
          <div className="wpm-section">
            <h3 className="wpm-section-title">Foco principal</h3>
            <p className="wpm-section-desc">Elementos con mayor presencia en el cronograma del mes.</p>
            <div className="wpm-focus-grid">
              <WpmFocusCol label="Proyectos" items={summary.topProjects} tone="project" />
              <WpmFocusCol label="Productos" items={summary.topProducts} tone="product" />
              <WpmFocusCol label="Tareas" items={summary.topTasks} tone="task" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WpmStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`wpm-stat is-${tone}`}>
      <span className="wpm-stat-value">{value}</span>
      <span className="wpm-stat-label">{label}</span>
    </div>
  );
}

function WpmLegendDot({ label, tone }: { label: string; tone: "project" | "product" | "task" }) {
  return (
    <span className={`wpm-legend-item is-${tone}`}>
      <span className="wpm-legend-dot" />
      {label}
    </span>
  );
}

function WpmFocusCol({ label, items, tone }: { label: string; items: { name: string; count: number }[]; tone: string }) {
  return (
    <div className="wpm-focus-col">
      <div className="wpm-focus-heading">{label}</div>
      {items.length === 0 ? (
        <div className="wpm-focus-empty">Sin datos</div>
      ) : (
        <div className="wpm-focus-list">
          {items.map((item) => (
            <div key={item.name} className={`wpm-focus-item is-${tone}`}>
              <span className="wpm-focus-name">{item.name}</span>
              <span className="wpm-focus-count">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkloadTooltipCard({
  tooltip,
}: {
  tooltip: {
    userName: string;
    weekLabel: string;
    rangeLabel: string;
    cell: WorkloadCell;
  };
}) {
  return (
    <div className="timeline-focus max-w-[360px]">
      <div className="space-y-1">
        <div className="text-xs font-semibold">{tooltip.userName}</div>
        <div className="text-[11px] text-secondary">
          {tooltip.weekLabel} · {tooltip.rangeLabel}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="timeline-focus-badge">Total {tooltip.cell.total}</span>
        <span className="timeline-focus-badge">Tareas {tooltip.cell.tasks}</span>
        <span className="timeline-focus-badge">Productos {tooltip.cell.products}</span>
        <span className="timeline-focus-badge">Proyectos {tooltip.cell.projects}</span>
      </div>

      <TooltipGroup label="Proyectos" items={tooltip.cell.project_names} />
      <TooltipGroup label="Productos" items={tooltip.cell.product_names} />
      <TooltipGroup label="Tareas" items={tooltip.cell.task_names} />
    </div>
  );
}

function TooltipGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.12em] text-secondary">{label}</div>
      <div className="text-[11px] leading-5 text-primary">{items.join(", ")}</div>
    </div>
  );
}
