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

function avatarColorClass(key: string): string {
  const palette = ["color-1", "color-2", "color-3", "color-4", "color-5"];
  const code = (key || "?").charCodeAt(0) || 0;
  return palette[code % palette.length];
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Workload({ currentUser }: { currentUser: AuthUser | null }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [onlyLoginUsers, setOnlyLoginUsers] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [scope, setScope] = useState<"mes" | "trimestre">("mes");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

  const baseUsers = useMemo(() => {
    const rows = workloadQuery.data?.users || [];
    const term = normalizeText(search);
    return rows.filter((row) => {
      if (onlyLoginUsers && !row.can_login) return false;
      if (!term) return true;
      return normalizeText(row.display_name).includes(term);
    });
  }, [onlyLoginUsers, search, workloadQuery.data?.users]);

  const teamsAvailable = useMemo(() => {
    const all = groupUsersByArea(workloadQuery.data?.users || []);
    return ["all", ...all.map((g) => g.key)];
  }, [workloadQuery.data?.users]);

  const filteredUsers = useMemo(() => {
    if (teamFilter === "all") return baseUsers;
    const group = AREA_GROUPS.find((g) => g.key === teamFilter);
    if (!group) return baseUsers;
    return baseUsers.filter((u) => group.members.includes(u.user_key.toLowerCase()));
  }, [baseUsers, teamFilter]);

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
      if (event.key === "Escape") setProfileUserKey(null);
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
  const periodLabel = workloadQuery.data?.label || `${MONTHS[month - 1].label} ${year}`;

  // Summary band metrics
  const weeklyAvg = useMemo(() => {
    if (filteredUsers.length === 0 || weeksData.length === 0) return 0;
    const sum = filteredUsers.reduce(
      (acc, u) => acc + u.weeks.reduce((s, c) => s + c.total, 0),
      0
    );
    return Math.round(sum / (filteredUsers.length * weeksData.length));
  }, [filteredUsers, weeksData.length]);

  const overAssigned = useMemo(
    () => filteredUsers.filter((u) => u.weeks.some((c) => c.total / totalMax > 0.75)).length,
    [filteredUsers, totalMax]
  );

  const idle = useMemo(
    () => filteredUsers.filter((u) => u.weeks.every((c) => c.total === 0)).length,
    [filteredUsers]
  );

  const exportCsv = () => {
    if (!filteredUsers.length || !weeksData.length) return;
    const header = ["Usuario", ...weeksData.map((w) => `${w.label} (${w.range_label})`)];
    const rows = filteredUsers.map((u) => [
      u.display_name,
      ...u.weeks.map((c) => String(c.total)),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `carga-${year}-${String(month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // scope reserved for future trimester view
  void scope;

  const intensityColor = (value: number) => {
    if (value === 0) return null;
    const t = Math.min(1, value / totalMax);
    if (t < 0.4) return "var(--info-soft)";
    if (t < 0.75) return "var(--info)";
    return "var(--accent)";
  };

  const teamLabelFor = (key: string): string => {
    if (key === "all") return "Todos";
    const g = AREA_GROUPS.find((x) => x.key === key);
    return g ? g.label : key.toUpperCase();
  };

  return (
    <div className="gp-content">
      <div className="page-eyebrow">Equipo · Carga semanal</div>
      <h1 className="page-title">Carga semanal por usuario</h1>
      <p className="page-subtitle">
        Ítems asignados (proyectos · productos · tareas) por semana. {periodLabel} ·{" "}
        {filteredUsers.length} usuarios.
      </p>

      {/* Controls row — single date button + Equipo segment + (right) scope + Exportar */}
      <div className="gp-row" style={{ gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="gp-row" style={{ gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Mes</span>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="ui-button"
              style={{ height: 30, padding: "0 12px" }}
              onClick={() => setDatePickerOpen((v) => !v)}
            >
              <span>
                {MONTHS[month - 1].label} {year}
              </span>
              <svg
                width={10}
                height={10}
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginLeft: 4 }}
              >
                <path d="m6 4 4 4-4 4" transform="rotate(90 9 9)" />
              </svg>
            </button>
            {datePickerOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 30,
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-muted)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-floating)",
                  padding: 10,
                  display: "flex",
                  gap: 6,
                  minWidth: 240,
                }}
                onMouseLeave={() => setDatePickerOpen(false)}
              >
                <select
                  className="ui-select"
                  style={{ flex: 1, minHeight: 32 }}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  style={{ width: 92, minHeight: 32 }}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 1 + i).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="gp-row" style={{ gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Equipo</span>
          <div className="ui-segmented">
            {teamsAvailable.map((t) => (
              <button
                key={t}
                type="button"
                className={`ui-segment ${teamFilter === t ? "is-active" : ""}`}
                onClick={() => setTeamFilter(t)}
              >
                {teamLabelFor(t)}
              </button>
            ))}
          </div>
        </div>
        <span className="gp-spacer-flex" />
        <div className="ui-segmented">
          {(["mes", "trimestre"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`ui-segment ${scope === s ? "is-active" : ""}`}
              onClick={() => setScope(s)}
              title={s === "trimestre" ? "Vista trimestral (próximamente)" : "Vista mensual"}
              disabled={s === "trimestre"}
              style={s === "trimestre" ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              {s === "mes" ? "Mes" : "Trimestre"}
            </button>
          ))}
        </div>
        <button type="button" className="ui-button" style={{ height: 30 }} onClick={exportCsv}>
          <svg
            width={13}
            height={13}
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 3v8M9 11l3-3M9 11 6 8M3 14h12" />
          </svg>
          Exportar
        </button>
      </div>

      {/* Secondary filter row */}
      <div className="gp-row" style={{ gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          className="ui-input"
          style={{ width: 240, minHeight: 30 }}
          placeholder="Filtrar usuarios…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label
          className="gp-row"
          style={{
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            padding: "5px 4px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={onlyLoginUsers}
            onChange={(e) => setOnlyLoginUsers(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Solo con acceso
        </label>
      </div>

      {/* Summary band */}
      <div className="gp-card" style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div className="gp-row" style={{ gap: 32, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Promedio del equipo
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, lineHeight: 1 }}>
              {weeklyAvg}
              <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 6 }}>ítems/sem</span>
            </div>
          </div>
          <div style={{ height: 36, width: 1, background: "var(--border-muted)" }} />
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Sobre-asignados
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: "var(--accent-text)", lineHeight: 1 }}>
              {overAssigned}
            </div>
          </div>
          <div style={{ height: 36, width: 1, background: "var(--border-muted)" }} />
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Sin asignación
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: "var(--text-muted)", lineHeight: 1 }}>
              {idle}
            </div>
          </div>
          <span className="gp-spacer-flex" />
          <div className="gp-row" style={{ gap: 14, fontSize: 11.5, color: "var(--text-muted)" }}>
            <div className="gp-row" style={{ gap: 6 }}>
              <span style={{ width: 16, height: 10, background: "var(--info-soft)", borderRadius: 2 }} />
              &lt;40%
            </div>
            <div className="gp-row" style={{ gap: 6 }}>
              <span style={{ width: 16, height: 10, background: "var(--info)", borderRadius: 2 }} />
              40-75%
            </div>
            <div className="gp-row" style={{ gap: 6 }}>
              <span style={{ width: 16, height: 10, background: "var(--accent)", borderRadius: 2 }} />
              &gt;75%
            </div>
          </div>
        </div>
      </div>

      {/* Gantt timeline */}
      <div className="gp-card" style={{ overflow: "hidden" }}>
        {workloadQuery.isLoading && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Cargando…
          </div>
        )}
        {workloadQuery.isError && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--accent-text)", fontSize: 13 }}>
            No se pudo cargar el cronograma de carga.
          </div>
        )}

        {!workloadQuery.isLoading && !workloadQuery.isError && weeksData.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `220px repeat(${weeksData.length}, minmax(96px, 1fr))`,
                minWidth: 220 + weeksData.length * 96,
              }}
            >
              {/* Header row */}
              <div
                style={{
                  background: "var(--bg-muted)",
                  borderBottom: "1px solid var(--border-muted)",
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Usuario
              </div>
              {weeksData.map((w) => (
                <div
                  key={w.id}
                  style={{
                    background: "var(--bg-muted)",
                    borderLeft: "1px solid var(--border-muted)",
                    borderBottom: "1px solid var(--border-muted)",
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{w.label}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    {w.range_label}
                  </div>
                </div>
              ))}

              {areaGroups.map((area) => {
                const isCollapsed = collapsedAreas.has(area.key);
                const totals = weeksData.map((_, i) =>
                  area.users.reduce((sum, u) => sum + (u.weeks[i]?.total ?? 0), 0)
                );
                return (
                  <Fragment key={area.key}>
                    {/* Team aggregate row */}
                    <button
                      type="button"
                      onClick={() => toggleArea(area.key)}
                      style={{
                        background: "var(--bg-muted)",
                        borderBottom: "1px solid var(--border-muted)",
                        padding: "8px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        color: "var(--text-secondary)",
                        textAlign: "left",
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 18 18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s" }}
                      >
                        <path d="m6 4 4 4-4 4" />
                      </svg>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {area.label}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {area.users.length}
                      </span>
                    </button>
                    {totals.map((t, i) => (
                      <div
                        key={i}
                        style={{
                          background: "var(--bg-muted)",
                          borderLeft: "1px solid var(--border-muted)",
                          borderBottom: "1px solid var(--border-muted)",
                          padding: "8px 14px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {t}
                        </span>
                      </div>
                    ))}

                    {/* User rows */}
                    {!isCollapsed &&
                      area.users.map((u) => {
                        const isSelected = selectedUserKey === u.user_key;
                        return (
                          <Fragment key={u.user_key}>
                            <div
                              style={{
                                padding: "6px 14px",
                                borderBottom: "1px solid var(--border-muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: isSelected ? "var(--bg-muted)" : "transparent",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserKey(u.user_key);
                                  setProfileUserKey(u.user_key);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  fontFamily: "inherit",
                                  color: "var(--text-primary)",
                                  width: "100%",
                                  minWidth: 0,
                                }}
                              >
                                <span className={`gp-avatar ${avatarColorClass(u.user_key)}`} style={{ width: 22, height: 22 }}>
                                  {initialsOf(u.display_name)}
                                </span>
                                <span className="gp-truncate" style={{ fontSize: 13 }}>
                                  {u.display_name}
                                  {u.user_key === currentUser?.user_key && (
                                    <span style={{ color: "var(--text-muted)" }}> · tú</span>
                                  )}
                                </span>
                              </button>
                            </div>
                            {u.weeks.map((cell, i) => {
                              const week = weeksData[i];
                              const pct = totalMax > 0 ? Math.min(1, cell.total / totalMax) : 0;
                              const fill = intensityColor(cell.total);
                              return (
                                <div
                                  key={cell.week_id}
                                  style={{
                                    borderLeft: "1px solid var(--border-muted)",
                                    borderBottom: "1px solid var(--border-muted)",
                                    padding: "6px 8px",
                                    height: 38,
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {cell.total > 0 && fill ? (
                                    <div
                                      onMouseEnter={(e) =>
                                        setTooltip(buildTooltipState(e, u.display_name, cell, weeksData))
                                      }
                                      onMouseMove={(e) =>
                                        setTooltip(buildTooltipState(e, u.display_name, cell, weeksData))
                                      }
                                      onMouseLeave={() => setTooltip(null)}
                                      style={{
                                        width: "100%",
                                        height: 18,
                                        background: "var(--bg-muted)",
                                        borderRadius: 4,
                                        position: "relative",
                                        overflow: "hidden",
                                        cursor: "pointer",
                                      }}
                                      title={week ? `${week.label} · ${cell.total} ítems` : `${cell.total}`}
                                    >
                                      <div
                                        style={{
                                          width: `${Math.min(100, pct * 100)}%`,
                                          height: "100%",
                                          background: fill,
                                          borderRadius: 4,
                                        }}
                                      />
                                      <span
                                        className="mono"
                                        style={{
                                          position: "absolute",
                                          inset: 0,
                                          display: "grid",
                                          placeItems: "center",
                                          fontSize: 10.5,
                                          color: pct > 0.5 ? "white" : "var(--text-secondary)",
                                          fontWeight: 500,
                                          pointerEvents: "none",
                                        }}
                                      >
                                        {cell.total}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                                      —
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </div>
            {filteredUsers.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No hay usuarios para el filtro actual.
              </div>
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
      </div>

      {profileUser && (
        <WorkloadProfileModal user={profileUser} weeks={weeksData} onClose={() => setProfileUserKey(null)} />
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
    if (cell.total > 0) activeWeeks += 1;
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
    uniqueProjects: [...uniqueProjects].sort((l, r) => l.localeCompare(r)),
    uniqueProducts: [...uniqueProducts].sort((l, r) => l.localeCompare(r)),
    uniqueTasks: [...uniqueTasks].sort((l, r) => l.localeCompare(r)),
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
    .sort((l, r) => r[1] - l[1] || l[0].localeCompare(r[0]))
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
  const initials = initialsOf(user.display_name);

  return (
    <div className="wpm-backdrop" onClick={onClose}>
      <div
        className="wpm-page"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Resumen de carga de ${user.display_name}`}
      >
        <div className="wpm-cover">
          <button type="button" className="wpm-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1 1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="wpm-avatar-row">
          <div className={`wpm-avatar ${avatarColorClass(user.user_key)}`}>{initials}</div>
        </div>
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
            <span className="wpm-tag">
              {summary.activeWeeks} de {weeks.length} semanas activas
            </span>
          </div>

          <div className="wpm-stats-row">
            <WpmStat label="Proyectos" value={summary.uniqueProjects.length} tone="project" />
            <WpmStat label="Productos" value={summary.uniqueProducts.length} tone="product" />
            <WpmStat label="Tareas" value={summary.uniqueTasks.length} tone="task" />
          </div>

          <div className="wpm-divider" />

          <div className="wpm-section">
            <h3 className="wpm-section-title">Distribución semanal</h3>
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
                      <div className={`wpm-chart-bar ${cell.total > 0 ? "is-active" : ""}`} style={{ height: `${barH}%` }}>
                        {cell.projects > 0 && (
                          <div className="wpm-seg is-project" style={{ flexGrow: cell.projects }} />
                        )}
                        {cell.products > 0 && (
                          <div className="wpm-seg is-product" style={{ flexGrow: cell.products }} />
                        )}
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

function WpmFocusCol({
  label,
  items,
  tone,
}: {
  label: string;
  items: { name: string; count: number }[];
  tone: string;
}) {
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
