import { DashboardResponse } from "../api/client";

type Props = {
  data?: DashboardResponse;
};

export function KPIPanel({ data }: Props) {
  const progress = data?.kpis?.progress_pct ?? 0;
  const overdue = data?.kpis?.tasks_overdue ?? 0;

  return (
    <div className="glass w-full overflow-hidden">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Resumen</h3>
          <p className="panel-subtitle">Señales clave del proyecto</p>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="stat-grid">
          <KPI label="Progreso" value={`${progress}%`} />
          <KPI label="Tareas" value={data?.kpis?.tasks_total ?? 0} />
          <KPI label="Vencidas" value={overdue} emphasize />
          <KPI label="Productos" value={data?.kpis?.products_total ?? 0} />
          <KPI label="Listos" value={data?.kpis?.products_done ?? 0} />
          <KPI label="Cerradas" value={data?.kpis?.tasks_done ?? 0} />
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, emphasize }: { label: string; value: string | number; emphasize?: boolean }) {
  return (
    <div className={`stat-card ${emphasize ? "stat-card--danger" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
