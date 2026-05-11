import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, HomeAlert, HomeOverviewResponse } from "../api/client";
import { formatDateLabel, toTimeValue } from "../utils/display";

type FilterKey = "todas" | "vencidas" | "proximas" | "importantes";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

const todayLabel = () => {
  const dt = new Date();
  return dt.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

export function Home() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<HomeOverviewResponse>({
    queryKey: ["home"],
    queryFn: api.home,
  });

  const projects = data?.projects || [];
  const alerts = data?.alerts || [];

  const visibleAlerts = useMemo(() => {
    let xs = alerts.slice();
    if (filter === "vencidas") xs = xs.filter((a) => a.alert_type === "overdue");
    else if (filter === "proximas") xs = xs.filter((a) => a.alert_type === "upcoming");
    else if (filter === "importantes") {
      xs = xs.filter((a) => (a.importancia || "").toLowerCase().includes("alta"));
    }
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (t) =>
          (t.tarea || "").toLowerCase().includes(q) ||
          (t.project_nombre || "").toLowerCase().includes(q)
      );
    }
    return xs.sort(
      (a, b) => toTimeValue(a.fecha_end || a.fecha_start) - toTimeValue(b.fecha_end || b.fecha_start)
    );
  }, [alerts, filter, search]);

  const grouped = useMemo(() => {
    const buckets: Record<string, HomeAlert[]> = {
      Vencidas: [],
      "Próximas": [],
    };
    visibleAlerts.forEach((a) => {
      if (a.alert_type === "overdue") buckets.Vencidas.push(a);
      else buckets["Próximas"].push(a);
    });
    return Object.entries(buckets).filter(([, v]) => v.length > 0);
  }, [visibleAlerts]);

  const totalOverdue = alerts.filter((a) => a.alert_type === "overdue").length;
  const totalUpcoming = alerts.filter((a) => a.alert_type === "upcoming").length;
  const activeProjects = projects.filter((p) => p.progress_pct > 0 && p.progress_pct < 100).length;

  return (
    <div className="gp-content">
      <div className="page-eyebrow">Proyectos · Vista general</div>
      <h1 className="page-title">
        {greeting()}, {projects.length ? "Ricardo" : ""}
      </h1>
      <p className="page-subtitle">
        <span style={{ textTransform: "capitalize" }}>{todayLabel()}</span>
        {" · "}
        {totalUpcoming} próximas
        {" · "}
        <span className="gp-muted">{totalOverdue} vencidas</span>
      </p>

      <div className="kpi-band" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div>
          <div className="lbl">Proyectos activos</div>
          <div className="val">
            {activeProjects}
            <span className="small"> / {projects.length}</span>
          </div>
        </div>
        <div>
          <div className="lbl">Tareas vencidas</div>
          <div className={`val ${totalOverdue > 0 ? "danger" : ""}`}>{totalOverdue}</div>
        </div>
        <div>
          <div className="lbl">Próximas</div>
          <div className="val">{totalUpcoming}</div>
        </div>
        <div>
          <div className="lbl">En foco</div>
          <div className="val">{alerts.length}</div>
        </div>
      </div>

      {isLoading && <p className="gp-muted" style={{ fontSize: 13 }}>Cargando proyectos…</p>}
      {isError && <p style={{ color: "var(--accent-text)", fontSize: 13 }}>No se pudieron cargar proyectos.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 24 }}>
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Proyectos<span className="count">{projects.length}</span>
          </div>
          <div className="gp-vstack" style={{ gap: 6 }}>
            {projects.length === 0 && !isLoading && (
              <div className="gp-muted" style={{ fontSize: 13 }}>Sin resultados</div>
            )}
            {projects.map((p) => (
              <button
                key={p.project_id}
                type="button"
                onClick={() => navigate(`/project/${encodeURIComponent(p.project_id)}`)}
                className="gp-card gp-card-pad"
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                }}
              >
                <div className="gp-row" style={{ marginBottom: 6 }}>
                  <span className="ico" style={{ color: "var(--text-muted)" }}>
                    <svg width={13} height={13} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 2.5h6L13.5 6v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Z" />
                      <path d="M10 2.5V6h3.5" />
                    </svg>
                  </span>
                  <span className="gp-truncate" style={{ fontWeight: 500, fontSize: 13.5 }}>
                    {p.nombre || "Sin nombre"}
                  </span>
                  <span className="gp-spacer-flex" />
                  {p.tasks_overdue > 0 && (
                    <span className="gp-pill danger">{p.tasks_overdue}</span>
                  )}
                </div>
                <div className="gp-row mono" style={{ fontSize: 11, color: "var(--text-muted)", gap: 12 }}>
                  <span>{p.products_total} prod</span>
                  <span>{p.tasks_total} tar</span>
                  <span className="gp-spacer-flex" />
                  <span style={{ color: p.progress_pct > 50 ? "var(--success)" : "var(--text-muted)" }}>
                    {p.progress_pct}%
                  </span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <div className={`gp-bar ${p.progress_pct >= 100 ? "success" : "accent"}`}>
                    <i style={{ width: `${Math.min(100, Math.max(0, p.progress_pct))}%` }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="gp-row" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>
              En foco<span className="count">{visibleAlerts.length}</span>
            </div>
            <span className="gp-spacer-flex" />
            <input
              className="ui-input"
              style={{ width: 200, minHeight: 30 }}
              placeholder="Buscar tarea…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="ui-segmented">
              {(
                [
                  ["todas", "Todas"],
                  ["proximas", "Próximas"],
                  ["vencidas", "Vencidas"],
                  ["importantes", "Importantes"],
                ] as [FilterKey, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={`ui-segment ${filter === k ? "is-active" : ""}`}
                  onClick={() => setFilter(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="gp-card" style={{ overflow: "hidden" }}>
            {grouped.length === 0 && (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Sin tareas en este filtro.
              </div>
            )}
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-muted)",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 500,
                  }}
                >
                  <span>{bucket}</span>
                  <span className="mono" style={{ marginLeft: "auto" }}>{items.length}</span>
                </div>
                {items.map((t) => {
                  const isOverdue = t.alert_type === "overdue";
                  return (
                    <button
                      key={t.task_id}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/project/${encodeURIComponent(t.project_id)}?productId=${encodeURIComponent(t.product_id || "")}&taskId=${encodeURIComponent(t.task_id)}`
                        )
                      }
                      className="gp-row"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border-muted)",
                        gap: 12,
                        cursor: "pointer",
                        background: "transparent",
                        border: "none",
                        borderTop: "none",
                        textAlign: "left",
                        fontFamily: "inherit",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          alignSelf: "stretch",
                          borderRadius: 2,
                          background: isOverdue ? "var(--accent)" : "var(--info)",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="gp-truncate" style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
                          {t.tarea || "Sin nombre"}
                        </div>
                        <div
                          className="gp-row"
                          style={{ gap: 8, marginTop: 2, fontSize: 11.5, color: "var(--text-muted)" }}
                        >
                          <span className="gp-truncate">{t.project_nombre}</span>
                          {t.estado && (
                            <>
                              <span>·</span>
                              <span className="gp-pill info">{t.estado}</span>
                            </>
                          )}
                          {(t.importancia || "").toLowerCase().includes("alta") && (
                            <span className="gp-pill warn">{t.importancia}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 110 }}>
                        <div className="mono" style={{ fontSize: 12, color: isOverdue ? "var(--accent-text)" : "var(--text-secondary)" }}>
                          {formatDateLabel(t.fecha_end || t.fecha_start)}
                        </div>
                        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                          {isOverdue ? "Vencida" : "Próxima"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
