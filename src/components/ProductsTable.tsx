import { useMemo } from "react";
import { PersonValue, Product } from "../api/client";
import { PropertyPills, searchableExtraPropertiesText } from "./DynamicProperties";
import {
  formatDateRangeLabel,
  formatRelativeDueLabel,
  personLabel,
  priorityBadgeClass,
  statusBadgeClass,
} from "../utils/display";

export type ProductFilters = {
  estado?: string;
  prioridad?: string;
  responsable?: string;
  conVencidas?: boolean;
  search?: string;
};

type Props = {
  products: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ProductFilters;
  onChangeFilters: (f: ProductFilters) => void;
};

export function ProductsTable({ products, selectedId, onSelect, filters, onChangeFilters }: Props) {
  const options = useMemo(() => {
    const estados = new Set<string>();
    const prioridades = new Set<string>();
    const responsables = new Set<string>();
      products.forEach((p) => {
        const estado = p.estado || "Sin empezar";
        estados.add(estado);
        if (p.prioridad) prioridades.add(p.prioridad);
        const name = personLabel(p.responsable);
        if (name) responsables.add(name);
      });
    return {
      estados: Array.from(estados),
      prioridades: Array.from(prioridades),
      responsables: Array.from(responsables),
    };
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const estado = p.estado || "Sin empezar";
      if (filters.estado && estado !== filters.estado) return false;
      if (filters.prioridad && p.prioridad !== filters.prioridad) return false;
      if (filters.responsable && personLabel(p.responsable) !== filters.responsable) return false;
      if (filters.conVencidas && p.tasks_overdue <= 0) return false;
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchesName = (p.nombre || "").toLowerCase().includes(term);
        const matchesExtra = searchableExtraPropertiesText(p.extra_properties).includes(term);
        if (!matchesName && !matchesExtra) return false;
      }
      return true;
    });
  }, [products, filters]);

  return (
    <div className="glass pdf-avoid-break">
      <div className="panel-header">
        <div className="panel-title">Productos</div>
        <div className="panel-meta">
          {filtered.length}/{products.length}
        </div>
      </div>
      <div className="px-3 py-2 flex flex-wrap items-center gap-2 text-[11px] border-b border-border-muted">
        <Select
          label="Estado"
          value={filters.estado || ""}
          options={options.estados}
          onChange={(v) => onChangeFilters({ ...filters, estado: v || undefined })}
        />
        <Select
          label="Prioridad"
          value={filters.prioridad || ""}
          options={options.prioridades}
          onChange={(v) => onChangeFilters({ ...filters, prioridad: v || undefined })}
        />
        <Select
          label="Responsable"
          value={filters.responsable || ""}
          options={options.responsables}
          onChange={(v) => onChangeFilters({ ...filters, responsable: v || undefined })}
        />
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={!!filters.conVencidas}
            onChange={(e) => onChangeFilters({ ...filters, conVencidas: e.target.checked })}
          />
          Con vencidas
        </label>
      </div>
      <div className="max-h-[360px] overflow-auto scrollbar-thin pdf-expand">
        <table className="ui-table w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Estado / Prioridad</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Progreso</th>
              <th className="px-3 py-2 text-right">Vencidas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const overdueCount = safeCount(p.tasks_overdue);
              const tasksDone = safeCount(p.tasks_done);
              const tasksTotal = safeCount(p.tasks_total);
              const progress = clampProgress(p.progress_pct);
              const rowClass = [
                "ui-table-row",
                "cursor-pointer",
                selectedId === p.product_id ? "ui-table-row--selected" : "",
                overdueCount > 0 ? "ui-table-row--overdue" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const statusLabel = p.estado || "Sin estado";
              const priorityLabel = p.prioridad || "Normal";
              const dueLabel = formatRelativeDue(p.fecha_entrega_end || p.fecha_entrega_start);
              const taskSummary = formatTaskSummary(tasksDone, tasksTotal);
              const progressLabel =
                tasksTotal > 0 ? `${Math.round(progress)}% · ${tasksDone}/${tasksTotal} tareas` : `${Math.round(progress)}% completado`;

              return (
                <tr key={p.product_id} onClick={() => onSelect(p.product_id)} className={rowClass}>
                  <td className="px-3 py-2">
                    <div className="ui-table-cell-stack">
                      {p.notion_url ? (
                        <a href={p.notion_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {p.nombre || "Sin nombre"}
                        </a>
                      ) : (
                        <span className="font-medium">{p.nombre || "Sin nombre"}</span>
                      )}
                      <span className="ui-table-meta">{taskSummary}</span>
                      <PropertyPills properties={p.extra_properties} limit={2} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={statusBadgeClass(p.estado, { emptyIsNeutral: false })}>{statusLabel}</span>
                      <span className={priorityBadgeClass(p.prioridad)}>{priorityLabel}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{personLabel(p.responsable) || "Sin responsable"}</td>
                  <td className="px-3 py-2">
                    <div className="ui-table-cell-stack">
                      <span>{formatDateRangeLabel(p.fecha_entrega_start, p.fecha_entrega_end)}</span>
                      {dueLabel ? <span className="ui-table-meta">{dueLabel}</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="ui-table-cell-stack">
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="ui-table-meta">{progressLabel}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`ui-badge ${overdueCount > 0 ? "ui-badge--danger" : "ui-badge--neutral"}`}>
                      {overdueCount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-secondary text-sm px-3 py-3">Sin resultados</p>}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-secondary">
      <span className="text-[10px]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ui-select">
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function personName(value: PersonValue): string | null {
  return personLabel(value);
}

function formatDateRange(start?: string | null, end?: string | null) {
  return formatDateRangeLabel(start, end);
}

function clampProgress(progress?: number | null) {
  const value = typeof progress === "number" && !Number.isNaN(progress) ? progress : 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function safeCount(value?: number | null) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

function formatTaskSummary(done: number, total: number) {
  if (!total) return "Sin tareas registradas";
  return `${done}/${total} tareas completadas`;
}

function formatRelativeDue(date?: string | null) {
  return formatRelativeDueLabel(date);
}
