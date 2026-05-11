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
import { ProjectCronograma } from "../components/ProjectCronograma";
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
  const [activeTab, setActiveTab] = useState<"cronograma" | "productos" | "tareas">("cronograma");
  const [timelineMode, setTimelineMode] = useState<"products" | "tasks">("products");
  const [toast, setToast] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);
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
      setActiveTab("productos");
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
      t.tarea || "",
      t.estado || "",
      t.importancia || "",
      primaryPerson(t.responsable) || "",
      t.fecha_start || "",
      t.fecha_end || "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvField).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
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

  const teamMembers = deriveTeamMembers(projectTasksQuery.data || []);

  return (
    <ProjectLayout
      project={project}
      currentUser={currentUser}
      productsCount={productsQuery.data?.length ?? project.products_total ?? 0}
      tasksCount={projectTasksQuery.data?.length ?? project.tasks_total ?? 0}
      overdueCount={dashboardQuery.data?.kpis?.tasks_overdue ?? project.tasks_overdue ?? 0}
      dashboard={dashboardQuery.data}
      teamMembers={teamMembers}
      search={productFilters.search || ""}
      onSearch={(term) => {
        setProductFilters({ ...productFilters, search: term });
        setTaskFilters({ ...taskFilters, search: term });
        setProjectTaskFilters({ ...projectTaskFilters, search: term });
      }}
      onOpenNotion={() => project?.notion_url && window.open(project.notion_url, "_blank")}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      canExportCsv={!!selectedProductTasks.length}
      isExporting={isExporting}
      canSync={!!currentUser?.can_view_workload}
      isSyncing={syncMutation.isPending}
      onSync={() => syncMutation.mutate()}
      toast={toast}
      provisionedUsers={provisionedUsers}
      onDismissProvisioned={() => setProvisionedUsers([])}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "cronograma" && (
        <ProjectCronograma
          data={timelineMode === "products" ? timelineProductsQuery.data : timelineTasksData}
          mode={timelineMode}
          onModeChange={handleTimelineMode}
          loading={timelineMode === "products" ? timelineProductsQuery.isLoading : projectTasksQuery.isLoading}
        />
      )}

      {activeTab === "productos" && (
        <div className="space-y-2">
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
              productId={selectedProductId}
              productName={productsQuery.data?.find((p) => p.product_id === selectedProductId)?.nombre || null}
              projectId={projectId}
            />
          ) : (
            <div
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border-muted)",
                borderRadius: 8,
                padding: 14,
                fontSize: 12.5,
                color: "var(--text-muted)",
              }}
            >
              Selecciona un producto para revisar sus tareas, bloqueos y fechas clave.
            </div>
          )}
        </div>
      )}

      {activeTab === "tareas" && (
        <TasksByProduct
          tasks={projectTasksQuery.data || []}
          products={productsQuery.data || []}
          filters={projectTaskFilters}
          onChangeFilters={setProjectTaskFilters}
        />
      )}
    </ProjectLayout>
  );
}

type TeamMember = { key: string; label: string; initials: string };

function deriveTeamMembers(tasks: Task[]): TeamMember[] {
  const seen = new Map<string, TeamMember>();
  const collect = (value: PersonValue | undefined | null) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const name = personLabel(value);
    if (!name) return;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase() || "?";
    seen.set(key, { key, label: name, initials });
  };
  tasks.forEach((t) => {
    collect(t.responsable as PersonValue);
    collect(t.asignado as PersonValue);
  });
  return [...seen.values()];
}

type LayoutProps = {
  project: ProjectType;
  currentUser: AuthUser | null;
  productsCount: number;
  tasksCount: number;
  overdueCount: number;
  dashboard?: DashboardResponse;
  teamMembers: TeamMember[];
  search: string;
  onSearch: (term: string) => void;
  onOpenNotion: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  canExportCsv: boolean;
  isExporting: boolean;
  canSync: boolean;
  isSyncing: boolean;
  onSync: () => void;
  toast: string | null;
  provisionedUsers: SyncProvisionedUser[];
  onDismissProvisioned: () => void;
  activeTab: "cronograma" | "productos" | "tareas";
  onTabChange: (tab: "cronograma" | "productos" | "tareas") => void;
  children: React.ReactNode;
};

function ProjectLayout({
  project,
  currentUser,
  productsCount,
  tasksCount,
  overdueCount,
  dashboard,
  teamMembers,
  search,
  onSearch,
  onOpenNotion,
  onExportCsv,
  onExportPdf,
  canExportCsv,
  isExporting,
  canSync,
  isSyncing,
  onSync,
  toast,
  provisionedUsers,
  onDismissProvisioned,
  activeTab,
  onTabChange,
  children,
}: LayoutProps) {
  return (
    <div className="gp-content" style={{ maxWidth: 1320 }}>
      <div className="page-eyebrow">
        <Link
          to="/home"
          style={{
            color: "var(--text-muted)",
            cursor: "pointer",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Proyectos
        </Link>{" "}
        / Detalle
      </div>
      <div className="gp-row" style={{ alignItems: "flex-start", marginTop: 4, gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {project.nombre || "Proyecto"}
          </h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            <span className="mono">{formatDate(project.fecha_start)}</span>
            {" → "}
            <span className="mono">{formatDate(project.fecha_end)}</span>
          </p>
          {currentUser && !currentUser.can_view_all ? (
            <p className="gp-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Vista filtrada para {currentUser.display_name}. Solo se muestran productos y tareas donde estás involucrado.
            </p>
          ) : null}
          <div className="gp-row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span className="gp-pill">
              <span className="dot" />
              {productsCount} productos
            </span>
            <span className="gp-pill">
              <span className="dot" />
              {tasksCount} tareas
            </span>
            {overdueCount > 0 && (
              <span className="gp-pill danger">{overdueCount} vencidas</span>
            )}
            {teamMembers.length > 0 && (
              <div
                className="gp-row"
                style={{ marginLeft: 10, gap: 0 }}
                title={teamMembers.map((m) => m.label).join(", ")}
              >
                {teamMembers.slice(0, 4).map((m, i) => (
                  <span
                    key={m.key}
                    className={`gp-avatar color-${(i % 5) + 1}`}
                    style={{
                      width: 22,
                      height: 22,
                      marginLeft: i === 0 ? 0 : -6,
                      border: "1.5px solid var(--bg-surface)",
                    }}
                  >
                    {m.initials}
                  </span>
                ))}
                {teamMembers.length > 4 && (
                  <span
                    className="gp-avatar"
                    style={{
                      width: 22,
                      height: 22,
                      marginLeft: -6,
                      border: "1.5px solid var(--bg-surface)",
                      background: "var(--bg-soft)",
                      color: "var(--text-secondary)",
                      fontSize: 9,
                    }}
                  >
                    +{teamMembers.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ width: 320, maxWidth: "100%" }}>
          <div
            className="gp-row"
            style={{
              background: "var(--bg-muted)",
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 8,
              gap: 8,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="7.5" r="4.5" />
              <path d="m11 11 3 3" />
            </svg>
            <input
              placeholder="Buscar producto o tarea…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                outline: "none",
                fontSize: 13,
                color: "var(--text-primary)",
                fontFamily: "inherit",
                minHeight: 24,
              }}
            />
          </div>
          <div className="gp-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="gp-icon-btn"
              onClick={onOpenNotion}
              disabled={!project.notion_url}
              title="Abrir en Notion"
              style={{ opacity: project.notion_url ? 1 : 0.5 }}
            >
              <NotionIcon className="proj-action-icon" />
            </button>
            <details className="proj-export-menu">
              <summary className="ui-button" style={{ height: 30, listStyle: "none" }}>
                <ExportIcon className="proj-action-icon" />
                <span>Exportar</span>
              </summary>
              <div className="proj-export-panel">
                <button type="button" className="proj-export-item" onClick={onExportCsv} disabled={!canExportCsv}>
                  <CsvIcon className="proj-export-item-icon" />
                  CSV
                </button>
                <button type="button" className="proj-export-item" onClick={onExportPdf} disabled={isExporting}>
                  <PdfIcon className="proj-export-item-icon" />
                  {isExporting ? "Generando…" : "PDF"}
                </button>
              </div>
            </details>
            {canSync && (
              <button
                type="button"
                className="ui-button"
                style={{
                  height: 30,
                  marginLeft: "auto",
                  background: "var(--accent)",
                  borderColor: "var(--accent)",
                  color: "white",
                }}
                onClick={onSync}
                disabled={isSyncing}
                title="Sincronizar con Notion"
              >
                <RefreshIcon className={`proj-action-icon ${isSyncing ? "animate-spin" : ""}`} />
                Sincronizar
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="gp-pill info"
          style={{ height: 24, padding: "0 10px", marginTop: 14, width: "fit-content" }}
        >
          {toast}
        </div>
      )}

      {provisionedUsers.length > 0 && (
        <div
          className="gp-card"
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--info-soft)",
            borderColor: "transparent",
          }}
        >
          <div className="gp-row" style={{ justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="page-eyebrow">Accesos nuevos</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                Comparte estas contraseñas temporales ahora. No quedan guardadas en la base.
              </div>
            </div>
            <button type="button" className="ui-button ui-button--ghost" onClick={onDismissProvisioned}>
              Cerrar
            </button>
          </div>
          <div className="mt-3 overflow-auto">
            <table className="ui-table w-full text-[12px]">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Clave temporal</th>
                  <th>Permiso</th>
                </tr>
              </thead>
              <tbody>
                {provisionedUsers.map((user) => (
                  <tr key={user.user_key} className="ui-table-row">
                    <td>
                      <div style={{ fontWeight: 500 }}>{user.display_name}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {user.user_key}
                      </div>
                    </td>
                    <td className="mono">{user.temporary_password}</td>
                    <td>{user.can_view_workload ? "Admin carga" : "Usuario"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI band */}
      <div style={{ marginTop: 20 }}>
        <KPIPanel data={dashboard} />
      </div>

      {/* Tabs */}
      <div className="gp-tabs" style={{ marginTop: 24 }}>
        {(
          [
            ["cronograma", "Cronograma"],
            ["productos", "Productos"],
            ["tareas", "Tareas"],
          ] as ["cronograma" | "productos" | "tareas", string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            className={`gp-tab ${activeTab === k ? "is-active" : ""}`}
            onClick={() => onTabChange(k)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full min-w-0">{children}</div>
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

function csvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
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
