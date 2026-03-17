import { useMemo } from "react";
import { PersonValue, Product, Task } from "../api/client";
import { PropertyPills, searchableExtraPropertiesText } from "./DynamicProperties";
import {
  formatDateRangeLabel,
  formatRelativeDueLabel,
  personLabel,
  priorityBadgeClass,
  statusBadgeClass,
  toTimeValue,
} from "../utils/display";

export type ProjectTaskFilters = {
  productId?: string;
  overdueOnly?: boolean;
  urgentOnly?: boolean;
  search?: string;
};

type Props = {
  tasks: Task[];
  products: Product[];
  filters: ProjectTaskFilters;
  onChangeFilters: (f: ProjectTaskFilters) => void;
};

type TaskGroup = { id: string; label: string; tasks: Task[] };

export function TasksByProduct({ tasks, products, filters, onChangeFilters }: Props) {
  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (!t.product_id) return;
      const label = t.product_nombre || "Sin nombre";
      map.set(t.product_id, label);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = (filters.search || "").toLowerCase();
    return tasks.filter((t) => {
      if (filters.productId && t.product_id !== filters.productId) return false;
      if (filters.overdueOnly && !t.is_overdue) return false;
      if (filters.urgentOnly && t.importancia?.toLowerCase() !== "urgente") return false;
      if (term) {
        const inTask = (t.tarea || "").toLowerCase().includes(term);
        const inProduct = (t.product_nombre || "").toLowerCase().includes(term);
        const inExtra = searchableExtraPropertiesText(t.extra_properties).includes(term);
        if (!inTask && !inProduct && !inExtra) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskGroup>();
    filteredTasks.forEach((t) => {
      const id = t.product_id || "unknown";
      const label = t.product_nombre || "Sin producto";
      if (!map.has(id)) map.set(id, { id, label, tasks: [] });
      map.get(id)!.tasks.push(t);
    });
    const order = new Map(
      [...products]
        .sort((a, b) => {
          return toTimeValue(a.fecha_entrega_end || a.fecha_entrega_start) - toTimeValue(b.fecha_entrega_end || b.fecha_entrega_start);
        })
        .map((p, idx) => [p.product_id, idx])
    );

    const sortedGroups = Array.from(map.values()).sort((a, b) => {
      const aOrder = order.get(a.id) ?? Number.POSITIVE_INFINITY;
      const bOrder = order.get(b.id) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.label.localeCompare(b.label);
    });

    sortedGroups.forEach((group) => {
      group.tasks.sort((a, b) => {
        return toTimeValue(a.fecha_start || a.fecha_end) - toTimeValue(b.fecha_start || b.fecha_end);
      });
    });

    return sortedGroups;
  }, [filteredTasks, products]);

  return (
    <div className="glass pdf-avoid-break">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">Tareas</span>
          <span className="panel-meta">{filteredTasks.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <label className="flex items-center gap-2 text-secondary">
            <span className="text-[10px]">Producto</span>
            <select
              value={filters.productId || ""}
              onChange={(e) => onChangeFilters({ ...filters, productId: e.target.value || undefined })}
              className="ui-select"
            >
              <option value="">Todos</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            label="Solo vencidas"
            checked={!!filters.overdueOnly}
            onChange={(v) => onChangeFilters({ ...filters, overdueOnly: v })}
          />
          <Toggle
            label="Urgentes"
            checked={!!filters.urgentOnly}
            onChange={(v) => onChangeFilters({ ...filters, urgentOnly: v })}
          />
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto scrollbar-thin p-3 space-y-3 pdf-expand">
        {grouped.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-secondary">
              <span>{group.label}</span>
              <span className="ui-badge">{group.tasks.length} tareas</span>
            </div>
            <table className="ui-table w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left">Tarea</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Importancia</th>
                  <th className="px-3 py-2 text-left">Responsable/Asignado</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-center">Bloqueo</th>
                </tr>
              </thead>
              <tbody>
                {group.tasks.map((t) => {
                  const rowClass = [
                    "ui-table-row",
                    t.is_overdue ? "ui-table-row--overdue" : "",
                    t.is_blocked || t.blocks_other_tasks ? "ui-table-row--blocked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const statusLabel = t.estado || "Sin estado";
                  const importanceLabel = t.importancia || "Normal";
                  const people = splitPeople(t.responsable, t.asignado);
                  const dueLabel = formatRelativeDue(t.fecha_end || t.fecha_start);

                  return (
                    <tr key={t.task_id} className={rowClass}>
                      <td className="px-3 py-2">
                        <div className="ui-table-cell-stack">
                          <a href={t.notion_url || "#"} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                            {t.tarea || "Sin nombre"}
                          </a>
                          {t.is_overdue && <span className="ui-badge ui-badge--danger">Vencida</span>}
                          <PropertyPills properties={t.extra_properties} limit={2} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={statusBadgeClass(t.estado)}>{statusLabel}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={priorityBadgeClass(t.importancia)}>{importanceLabel}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="ui-table-cell-stack">
                          <span>{people.responsable || people.asignado || "Sin responsable"}</span>
                          {people.responsable &&
                            people.asignado &&
                            people.responsable !== people.asignado && (
                              <span className="ui-table-meta">Asignado: {people.asignado}</span>
                            )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="ui-table-cell-stack">
                          <span>{formatDateRangeLabel(t.fecha_start, t.fecha_end)}</span>
                          {dueLabel ? <span className="ui-table-meta">{dueLabel}</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {t.is_blocked && <span className="ui-badge ui-badge--warning">Bloqueada</span>}
                          {t.blocks_other_tasks && <span className="ui-badge ui-badge--info">Bloquea</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-secondary text-sm">Sin tareas</p>}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-pill">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function personName(value: PersonValue): string | null {
  return personLabel(value);
}

function splitPeople(
  responsable: PersonValue,
  asignado: PersonValue
): { responsable: string | null; asignado: string | null } {
  return {
    responsable: personName(responsable),
    asignado: personName(asignado),
  };
}

function formatDateRange(start?: string | null, end?: string | null) {
  return formatDateRangeLabel(start, end, "Sin fecha");
}

function formatRelativeDue(date?: string | null) {
  return formatRelativeDueLabel(date, { today: "Vence hoy", upcomingPrefix: "Faltan", overduePrefix: "Atrasada" });
}
