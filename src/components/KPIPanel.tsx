import { DashboardResponse } from "../api/client";

type Props = {
  data?: DashboardResponse;
};

export function KPIPanel({ data }: Props) {
  const progress = data?.kpis?.progress_pct ?? 0;
  const overdue = data?.kpis?.tasks_overdue ?? 0;

  const items: { label: string; value: string | number; danger?: boolean }[] = [
    { label: "Progreso", value: `${progress}%` },
    { label: "Tareas", value: data?.kpis?.tasks_total ?? 0 },
    { label: "Vencidas", value: overdue, danger: overdue > 0 },
    { label: "Productos", value: data?.kpis?.products_total ?? 0 },
    { label: "Listos", value: data?.kpis?.products_done ?? 0 },
    { label: "Cerradas", value: data?.kpis?.tasks_done ?? 0 },
  ];

  return (
    <div className="kpi-band kpi-band--project">
      {items.map((s) => (
        <div key={s.label}>
          <div className="lbl">{s.label}</div>
          <div className={`val ${s.danger ? "danger" : ""}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
