import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  AuthUser,
  DashboardResponse,
  PersonValue,
  Product,
  Project as ProjectType,
  SyncProvisionedUser,
  Task,
  TimelineResponse,
} from "../api/client";
import { PropertyGrid, searchableExtraPropertiesText } from "../components/DynamicProperties";
import { KPIPanel } from "../components/KPIPanel";
import { ProductFilters, ProductsTable } from "../components/ProductsTable";
import { ProjectTaskFilters, TasksByProduct } from "../components/TasksByProduct";
import { TaskFilters, TasksPanel } from "../components/TasksPanel";
import { Timeline } from "../components/Timeline";
import { formatDateLabel, personLabel, toTimeValue } from "../utils/display";
import { exportProjectPdf } from "../utils/exportPdf";

export function Project({ currentUser }: { currentUser: AuthUser | null }) {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productFilters, setProductFilters] = useState<ProductFilters>({});
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({});
  const [projectTaskFilters, setProjectTaskFilters] = useState<ProjectTaskFilters>({});
  const [listTab, setListTab] = useState<"products" | "tasks">("products");
  const [timelineMode, setTimelineMode] = useState<"products" | "tasks">("products");
  const [toast, setToast] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [provisionedUsers, setProvisionedUsers] = useState<SyncProvisionedUser[]>([]);
  const productIdParam = searchParams.get("productId");
  const taskIdParam = searchParams.get("taskId");

  const projectsQuery = useQuery<ProjectType[]>({ queryKey: ["projects"], queryFn: api.projects });
  const project = useMemo(
    () => projectsQuery.data?.find((p) => p.project_id === projectId),
    [projectsQuery.data, projectId]
  );

  const productsQuery = useQuery<Product[]>({
    queryKey: ["products", projectId],
    queryFn: () => api.projectProducts(projectId!),
    enabled: !!projectId,
  });

  const projectTasksQuery = useQuery<Task[]>({
    queryKey: ["projectTasks", projectId],
    queryFn: () => api.projectTasks(projectId!),
    enabled: !!projectId,
  });

  const dashboardQuery = useQuery<DashboardResponse>({
    queryKey: ["dashboard", projectId],
    queryFn: () => api.projectDashboard(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (productIdParam) {
      setSelectedProductId(productIdParam);
      setListTab("products");
    }
  }, [productIdParam]);

  const timelineProductsQuery = useQuery<TimelineResponse>({
    queryKey: ["timeline", projectId, "products"],
    queryFn: () => api.timeline(projectId!, "products"),
    enabled: !!projectId,
  });

  const timelineTasksData = useMemo((): TimelineResponse => {
    const tasks = projectTasksQuery.data || [];
    const products = productsQuery.data || [];
    const hitoRank = (value: number | null | undefined) =>
      typeof value === "number" && !Number.isNaN(value) ? value : Number.POSITIVE_INFINITY;
    const productsSorted = [...products].sort((a, b) => {
      const byHito = hitoRank(a.hito) - hitoRank(b.hito);
      if (byHito !== 0) return byHito;
      const aTime = toTimeValue(a.fecha_entrega_end || a.fecha_entrega_start);
      const bTime = toTimeValue(b.fecha_entrega_end || b.fecha_entrega_start);
      if (aTime !== bTime) return aTime - bTime;
      return (a.nombre || "").localeCompare(b.nombre || "");
    });
    const productOrder = new Map(productsSorted.map((p, idx) => [p.product_id, idx]));
    const items = tasks
      .filter((t) => t.fecha_start || t.fecha_end)
      .map((t) => ({
        id: t.task_id,
        group: t.product_id || "unknown",
        label: t.tarea || "Sin nombre",
        start: t.fecha_start || t.fecha_end,
        end: t.fecha_end || t.fecha_start,
        status: t.estado,
        is_overdue: t.is_overdue,
      }))
      .sort((a, b) => {
        const aOrder = productOrder.get(a.group || "") ?? Number.MAX_SAFE_INTEGER;
        const bOrder = productOrder.get(b.group || "") ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return toTimeValue(a.start || a.end) - toTimeValue(b.start || b.end);
      });
    const groups = productsSorted.map((p) => ({
      id: p.product_id,
      label: p.nombre || "Producto",
    }));
    return {
      mode: "tasks",
      groups,
      items,
    };
  }, [projectTasksQuery.data, productsQuery.data]);

  const selectedProductTasks = useMemo(() => {
    if (!selectedProductId) return [];
    return (projectTasksQuery.data || []).filter((task) => task.product_id === selectedProductId);
  }, [projectTasksQuery.data, selectedProductId]);

  const syncMutation = useMutation({
    mutationFn: api.sync,
    onSuccess: (result) => {
      const createdUsers = result.new_login_users || [];
      setProvisionedUsers(createdUsers);
      setToast(createdUsers.length ? `Sincronización completa · ${createdUsers.length} accesos nuevos` : "Sincronización completa");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
      queryClient.invalidateQueries({ queryKey: ["products", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projectTasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", projectId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", projectId] });
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => setToast("No se pudo sincronizar"),
  });

  const handleTimelineMode = (mode: "products" | "tasks") => {
    setTimelineMode(mode);
  };

  const exportCsv = () => {
    if (!selectedProductTasks.length) return;
    const header = ["tarea", "estado", "importancia", "responsable", "fecha_start", "fecha_end"];
    const rows = selectedProductTasks.map((t) => [
      `"${(t.tarea || "").replace(/"/g, '""')}"`,
      t.estado || "",
      t.importancia || "",
      primaryPerson(t.responsable) || "",
      t.fecha_start || "",
      t.fecha_end || "",
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-${projectId}-tasks.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      exportProjectPdf({
        projectName: project?.nombre || "Proyecto",
        periodLabel: projectPeriodLabel(project?.fecha_start, project?.fecha_end),
        dashboard: dashboardQuery.data,
        products: productsQuery.data || [],
        tasks: projectTasksQuery.data || [],
        timelineItems: timelineTasksData.items,
      });
    } catch (error) {
      setToast("No se pudo generar el PDF");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (!selectedProductTasks.length) return [];
    const term = (taskFilters.search || "").toLowerCase();
    if (!term) return selectedProductTasks;
    return selectedProductTasks.filter((t) => {
      if ((t.tarea || "").toLowerCase().includes(term)) return true;
      return searchableExtraPropertiesText(t.extra_properties).includes(term);
    });
  }, [selectedProductTasks, taskFilters.search]);

  if (!projectId) {
    return <p className="text-secondary">Proyecto no encontrado.</p>;
  }

  if (projectsQuery.isLoading) {
    return <p className="text-secondary">Cargando proyecto...</p>;
  }

  if (!project) {
    return <p className="text-secondary">No se encontró el proyecto solicitado.</p>;
  }

  return (
    <div className="min-h-full overflow-hidden flex flex-col gap-4">
      <div className="glass relative overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-secondary">
                <Link to="/home" className="ui-link ui-link--subtle">
                  Proyectos
                </Link>
                <span>/</span>
                <span>Detalle</span>
              </div>
              <div className="space-y-2">
                <h1 className="truncate text-[34px] leading-[0.98] font-semibold sm:text-[42px]">
                  {project?.nombre || "Proyecto"}
                </h1>
                <p className="max-w-2xl text-sm text-secondary">
                  {projectPeriodLabel(project?.fecha_start, project?.fecha_end)}
                </p>
                {currentUser && !currentUser.can_view_all ? (
                  <p className="max-w-2xl text-xs text-secondary">
                    Vista filtrada para {currentUser.display_name}. Solo se muestran productos y tareas
                    donde estás involucrado.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="ui-badge ui-badge--neutral">
                  {productsQuery.data?.length ?? project.products_total ?? 0} productos
                </span>
                <span className="ui-badge ui-badge--neutral">
                  {projectTasksQuery.data?.length ?? project.tasks_total ?? 0} tareas
                </span>
                {dashboardQuery.data?.kpis?.tasks_overdue ? (
                  <span className="ui-badge ui-badge--danger">
                    {dashboardQuery.data.kpis.tasks_overdue} vencidas
                  </span>
                ) : null}
              </div>
              {project.extra_properties && Object.keys(project.extra_properties).length > 0 ? (
                <div className="pt-1">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-secondary">
                    Propiedades adicionales
                  </div>
                  <PropertyGrid properties={project.extra_properties} />
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[320px]">
              <input
                placeholder="Buscar producto o tarea..."
                className="ui-input w-full"
                value={productFilters.search || ""}
                onChange={(e) => {
                  const term = e.target.value;
                  setProductFilters({ ...productFilters, search: term });
                  setTaskFilters({ ...taskFilters, search: term });
                  setProjectTaskFilters({ ...projectTaskFilters, search: term });
                }}
              />
              <div className="proj-actions">
                <button
                  className="proj-action-btn"
                  onClick={() => project?.notion_url && window.open(project.notion_url, "_blank")}
                  disabled={!project?.notion_url}
                  title="Abrir en Notion"
                >
                  <NotionIcon className="proj-action-icon" />
                </button>
                <details className="proj-export-menu">
                  <summary className="proj-action-btn">
                    <ExportIcon className="proj-action-icon" />
                    <span>Exportar</span>
                  </summary>
                  <div className="proj-export-panel">
                    <button
                      type="button"
                      className="proj-export-item"
                      onClick={exportCsv}
                      disabled={!selectedProductTasks.length}
                    >
                      <CsvIcon className="proj-export-item-icon" />
                      CSV
                    </button>
                    <button
                      type="button"
                      className="proj-export-item"
                      onClick={exportPdf}
                      disabled={isExporting}
                    >
                      <PdfIcon className="proj-export-item-icon" />
                      {isExporting ? "Generando..." : "PDF"}
                    </button>
                  </div>
                </details>
                {currentUser?.can_view_workload ? (
                  <button
                    className="proj-action-btn proj-action-btn--sync"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    title="Sincronizar con Notion"
                  >
                    <RefreshIcon className={`proj-action-icon ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {toast && <div className="ui-badge ui-badge--accent w-fit">{toast}</div>}
          {provisionedUsers.length ? (
            <div className="glass border border-[rgba(35,131,226,0.16)] bg-[rgba(35,131,226,0.06)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-secondary">Accesos nuevos</div>
                  <div className="text-sm text-primary">Comparte estas contraseñas temporales ahora. No quedan guardadas en la base.</div>
                </div>
                <button type="button" className="ui-button ui-button--ghost" onClick={() => setProvisionedUsers([])}>
                  Cerrar
                </button>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="ui-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left">Usuario</th>
                      <th className="px-3 py-2 text-left">Clave temporal</th>
                      <th className="px-3 py-2 text-left">Permiso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provisionedUsers.map((user) => (
                      <tr key={user.user_key} className="ui-table-row">
                        <td className="px-3 py-2">
                          <div className="font-medium">{user.display_name}</div>
                          <div className="ui-table-meta">{user.user_key}</div>
                        </td>
                        <td className="px-3 py-2 font-mono">{user.temporary_password}</td>
                        <td className="px-3 py-2">{user.can_view_workload ? "Admin carga" : "Usuario"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <KPIPanel data={dashboardQuery.data} />

        <div className="flex flex-col gap-3 w-full min-w-0">
          <Timeline
            data={timelineMode === "products" ? timelineProductsQuery.data : timelineTasksData}
            mode={timelineMode}
            onModeChange={handleTimelineMode}
            loading={timelineMode === "products" ? timelineProductsQuery.isLoading : projectTasksQuery.isLoading}
            className="w-full"
          />

          <div className="space-y-2">
            <div className="ui-segmented">
              <button
                className={`ui-segment ${listTab === "products" ? "is-active" : ""}`}
                onClick={() => setListTab("products")}
              >
                Productos
              </button>
              <button className={`ui-segment ${listTab === "tasks" ? "is-active" : ""}`} onClick={() => setListTab("tasks")}>
                Tareas
              </button>
            </div>

            {listTab === "products" ? (
              <>
                <ProductsTable
                  products={productsQuery.data || []}
                  selectedId={selectedProductId}
                  onSelect={setSelectedProductId}
                  filters={productFilters}
                  onChangeFilters={setProductFilters}
                />
                {selectedProductId ? (
                  <TasksPanel
                    tasks={filteredTasks}
                    filters={taskFilters}
                    onChangeFilters={setTaskFilters}
                    highlightTaskId={taskIdParam}
                  />
                ) : (
                  <div className="glass p-3 text-xs text-secondary">
                    Selecciona un producto para revisar sus tareas, bloqueos y fechas clave.
                  </div>
                )}
              </>
            ) : (
              <TasksByProduct
                tasks={projectTasksQuery.data || []}
                products={productsQuery.data || []}
                filters={projectTaskFilters}
                onChangeFilters={setProjectTaskFilters}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  return formatDateLabel(value, "—");
}

function projectPeriodLabel(start?: string | null, end?: string | null) {
  return `Inicio ${formatDate(start)} · Entrega ${formatDate(end)}`;
}

function primaryPerson(responsable: PersonValue): string | null {
  return personLabel(responsable);
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" fill="none">
      <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="currentColor"/>
      <path d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l12.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V17.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 0.333C69.893 -2.86 68.147 -0.357 61.35 0.227zM25.5 17.89c-5.2 0.35 -6.38 0.43 -9.337 -1.983L8.88 10.14c-0.78 -0.78 -0.39 -1.75 1.36 -1.943l51.443 -3.693c4.473 -0.39 6.8 1.167 8.543 2.527l9.72 7c0.39 0.193 1.36 1.553 0.193 1.553l-53.28 3.14v-0.833zM19.513 88.303V30.42c0 -2.53 0.78 -3.697 3.113 -3.89l58.1 -3.307c2.14 -0.193 3.11 1.167 3.11 3.693v57.497c0 2.53 -0.39 4.67 -3.89 4.863l-55.69 3.307c-3.5 0.193 -4.743 -0.967 -4.743 -4.28zM71.427 33.727c0.39 1.75 0 3.5 -1.75 3.7l-2.723 0.583v42.767c-2.333 1.36 -4.473 2.14 -6.22 2.14 -2.917 0 -3.693 -0.78 -5.833 -3.5L36.667 52.143v25.673l5.833 1.36s0 3.5 -4.863 3.5l-13.417 0.78c-0.39 -0.78 0 -2.723 1.36 -3.11l3.5 -0.967V44.057l-4.863 -0.39c-0.39 -1.75 0.583 -4.277 3.307 -4.473l14.393 -0.97 19.637 30.03V44.447l-4.863 -0.583c-0.39 -2.14 1.167 -3.693 3.11 -3.89l13.417 -0.78z" fill="rgba(255,255,255,0.9)"/>
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      <path d="M21 3v9h-9" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15v-2h2a1 1 0 1 0 0-2H9v6" />
    </svg>
  );
}
