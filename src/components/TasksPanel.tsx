import { useMemo } from "react";
import { PersonValue, Task } from "../api/client";
import { PropertyPills, searchableExtraPropertiesText } from "./DynamicProperties";
import {
  formatDateRangeLabel,
  formatRelativeDueLabel,
  personLabel,
  priorityBadgeClass,
  statusBadgeClass,
} from "../utils/display";

export type TaskFilters = {
  overdueOnly?: boolean;
  urgentOnly?: boolean;
  search?: string;
};

type Props = {
  tasks: Task[];
  filters: TaskFilters;
  onChangeFilters: (f: TaskFilters) => void;
  highlightTaskId?: string | null;
};

export function TasksPanel({ tasks, filters, onChangeFilters, highlightTaskId }: Props) {
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.overdueOnly && !t.is_overdue) return false;
      if (filters.urgentOnly && t.importancia?.toLowerCase() !== "urgente") return false;
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchesName = (t.tarea || "").toLowerCase().includes(term);
        const matchesExtra = searchableExtraPropertiesText(t.extra_properties).includes(term);
        if (!matchesName && !matchesExtra) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  return (
    <div className="glass mt-2 pdf-avoid-break">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">Tareas</span>
          <span className="panel-meta">{filtered.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
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
      <div className="max-h-[320px] overflow-auto scrollbar-thin pdf-expand">
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
            {filtered.map((t) => {
              const rowClass = [
                "ui-table-row",
                highlightTaskId === t.task_id ? "ui-table-row--selected" : "",
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
        {filtered.length === 0 && <p className="text-secondary text-sm px-3 py-3">Sin tareas</p>}
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
