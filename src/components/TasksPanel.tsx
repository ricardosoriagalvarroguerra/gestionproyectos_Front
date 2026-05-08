import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PersonValue, Task } from "../api/client";
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
  productId?: string | null;
  productName?: string | null;
  projectId?: string | null;
};

const ESTADO_OPTIONS = ["Sin empezar", "En curso", "En Revisión", "Listo"];
const IMPORTANCIA_OPTIONS = ["Normal", "Media", "Alta", "Urgente"];

export function TasksPanel({
  tasks,
  filters,
  onChangeFilters,
  highlightTaskId,
  productId,
  productName,
  projectId,
}: Props) {
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

  const [showCreateModal, setShowCreateModal] = useState(false);

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
          {productId ? (
            <button
              type="button"
              className="ui-button ui-button--primary text-[11px] px-3 py-1.5"
              onClick={() => setShowCreateModal(true)}
            >
              + Nueva tarea
            </button>
          ) : null}
        </div>
      </div>
      {showCreateModal && productId ? (
        <NewTaskModal
          productId={productId}
          productName={productName}
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
        />
      ) : null}
      <div className="max-h-[320px] overflow-auto scrollbar-thin pdf-expand">
        <table className="ui-table min-w-[920px] w-full text-[13px]">
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

function NewTaskModal({
  productId,
  productName,
  projectId,
  onClose,
}: {
  productId: string;
  productName?: string | null;
  projectId?: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tarea, setTarea] = useState("");
  const [estado, setEstado] = useState<string>("Sin empezar");
  const [importancia, setImportancia] = useState<string>("Normal");
  const [fechaStart, setFechaStart] = useState<string>("");
  const [fechaEnd, setFechaEnd] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createProductTask(productId, {
        tarea: tarea.trim(),
        estado: estado || null,
        importancia: importancia || null,
        fecha_start: fechaStart || null,
        fecha_end: fechaEnd || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productTasks", productId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["projectTasks", projectId] });
        queryClient.invalidateQueries({ queryKey: ["dashboard", projectId] });
        queryClient.invalidateQueries({ queryKey: ["timeline", projectId] });
        queryClient.invalidateQueries({ queryKey: ["products", projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ["home"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo crear la tarea";
      setError(message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tarea.trim()) {
      setError("El nombre de la tarea es requerido.");
      return;
    }
    if (fechaStart && fechaEnd && fechaStart > fechaEnd) {
      setError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="new-task-backdrop" onClick={onClose}>
      <div
        className="new-task-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Crear nueva tarea"
      >
        <div className="new-task-header">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-secondary">Nueva tarea</div>
            <h3 className="text-[18px] font-semibold leading-tight mt-1">
              {productName || "Producto"}
            </h3>
          </div>
          <button type="button" className="new-task-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="new-task-body">
          <label className="new-task-field">
            <span>Tarea</span>
            <input
              autoFocus
              type="text"
              className="ui-input"
              value={tarea}
              onChange={(e) => setTarea(e.target.value)}
              placeholder="Describe la tarea"
              maxLength={200}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="new-task-field">
              <span>Estado</span>
              <select
                className="ui-select"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="new-task-field">
              <span>Importancia</span>
              <select
                className="ui-select"
                value={importancia}
                onChange={(e) => setImportancia(e.target.value)}
              >
                {IMPORTANCIA_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="new-task-field">
              <span>Inicio</span>
              <input
                type="date"
                className="ui-input"
                value={fechaStart}
                onChange={(e) => setFechaStart(e.target.value)}
              />
            </label>
            <label className="new-task-field">
              <span>Fin</span>
              <input
                type="date"
                className="ui-input"
                value={fechaEnd}
                onChange={(e) => setFechaEnd(e.target.value)}
              />
            </label>
          </div>

          {error ? (
            <div className="new-task-error">{error}</div>
          ) : (
            <div className="text-[11px] text-secondary">
              La tarea se creará en Notion y aparecerá en la app cuando termine.
            </div>
          )}

          <div className="new-task-actions">
            <button type="button" className="ui-button ui-button--ghost" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </button>
            <button type="submit" className="ui-button ui-button--primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Creando..." : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
