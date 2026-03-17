import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, HomeAlert, HomeOverviewResponse, Product, Project } from "../api/client";
import { PropertyPills, searchableExtraPropertiesText } from "../components/DynamicProperties";
import { formatDateLabel, toTimeValue } from "../utils/display";

export function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError } = useQuery<HomeOverviewResponse>({
    queryKey: ["home"],
    queryFn: api.home,
  });
  const projects = data?.projects || [];
  const alerts = data?.alerts || [];
  const projectProducts = data?.project_products || {};

  const filtered = useMemo(() => {
    if (!projects.length) return [];
    const term = search.toLowerCase();
    return projects.filter((p) => {
      if ((p.nombre || "").toLowerCase().includes(term)) return true;
      return searchableExtraPropertiesText(p.extra_properties).includes(term);
    });
  }, [projects, search]);

  const feedItems = useMemo(() => {
    const term = search.toLowerCase();
    const filteredItems = term
      ? alerts.filter(
          (t) =>
            (t.tarea || "").toLowerCase().includes(term) ||
            (t.project_nombre || "").toLowerCase().includes(term)
        )
      : alerts;
    return filteredItems.sort((a, b) => {
      return toTimeValue(a.fecha_end || a.fecha_start) - toTimeValue(b.fecha_end || b.fecha_start);
    });
  }, [alerts, search]);

  return (
    <div className="min-h-full space-y-4 sm:space-y-5">
      <section className="glass overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="space-y-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.28em] text-secondary">Project hub</p>
              <div className="max-w-3xl space-y-2">
                <h1 className="text-[38px] leading-[0.95] font-semibold sm:text-[48px]">
                  Gestión de proyectos
                </h1>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                placeholder="Buscar proyecto, producto o tarea"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ui-input w-full sm:max-w-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {isLoading && <p className="px-1 text-sm text-secondary">Cargando proyectos...</p>}
      {isError && <p className="px-1 text-sm text-red-600">No se pudieron cargar proyectos.</p>}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="glass h-fit overflow-hidden">
          <div className="panel-header">
            <div>
              <div className="panel-title">Explorar</div>
            </div>
            <div className="panel-meta">{filtered.length}</div>
          </div>
          <div className="max-h-[72vh] space-y-2 overflow-auto p-3 scrollbar-thin">
            {filtered.length === 0 && <p className="text-sm text-secondary">Sin resultados</p>}
            {filtered.map((project) => (
              <ProjectSidebarItem
                key={project.project_id}
                project={project}
                expanded={!!expandedProjects[project.project_id]}
                onToggle={() =>
                  setExpandedProjects((prev) => ({
                    ...prev,
                    [project.project_id]: !prev[project.project_id],
                  }))
                }
                expandedProducts={expandedProducts}
                products={projectProducts[project.project_id] || []}
                onToggleProduct={(productId) =>
                  setExpandedProducts((prev) => ({ ...prev, [productId]: !prev[productId] }))
                }
                onNavigate={navigate}
                search={search}
              />
            ))}
          </div>
        </aside>

        <section className="glass overflow-hidden">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">En foco</h2>
              <p className="panel-subtitle">Tareas que requieren atención primero</p>
            </div>
            <div className="panel-meta">{feedItems.length}</div>
          </div>
          <div className="space-y-2 p-3">
            {feedItems.length === 0 && (
              <div className="empty-panel">
                <p>Todo está al día. No hay tareas críticas ni próximas por vencer.</p>
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {feedItems.map((task: HomeAlert) => (
                <button
                  key={task.task_id}
                  className={`list-card text-left ${
                    task.alert_type === "overdue" ? "list-card--overdue" : "list-card--upcoming"
                  }`}
                  onClick={() =>
                    navigate(
                      `/project/${task.project_id}?productId=${encodeURIComponent(
                        task.product_id || ""
                      )}&taskId=${encodeURIComponent(task.task_id)}`
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`ui-badge ${
                            task.alert_type === "overdue" ? "ui-badge--danger" : "ui-badge--warning"
                          }`}
                        >
                          {task.alert_type === "overdue" ? "Vencida" : "Próxima"}
                        </span>
                        {task.importancia && (
                          <span className="ui-badge ui-badge--neutral">{task.importancia}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="line-clamp-2 text-sm font-semibold leading-5 text-primary">
                          {task.tarea || "Sin nombre"}
                        </div>
                        <div className="text-xs text-secondary">{task.project_nombre}</div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-secondary">
                      <div>{formatDateLabel(task.fecha_end || task.fecha_start)}</div>
                      <div>{task.estado || "Sin estado"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectSidebarItem({
  project,
  expanded,
  onToggle,
  expandedProducts,
  products,
  onToggleProduct,
  onNavigate,
  search,
}: {
  project: Project;
  expanded: boolean;
  onToggle: () => void;
  expandedProducts: Record<string, boolean>;
  products: Product[];
  onToggleProduct: (productId: string) => void;
  onNavigate: (path: string) => void;
  search: string;
}) {
  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return products;
    return products.filter((p) => {
      if ((p.nombre || "").toLowerCase().includes(term)) return true;
      return searchableExtraPropertiesText(p.extra_properties).includes(term);
    });
  }, [products, search]);

  return (
    <div className="disclosure-card">
      <div className="disclosure-header">
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-primary">
            {project.nombre || "Sin nombre"}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-secondary">
            <span>{project.products_total} productos</span>
            <span>·</span>
            <span>{project.progress_pct}%</span>
          </div>
          <PropertyPills
            properties={project.extra_properties}
            limit={2}
            className="mt-2"
            excludeLabels={["Involucrados", "# productos completados"]}
          />
        </button>
        <button onClick={() => onNavigate(`/project/${project.project_id}`)} className="ui-link">
          Abrir
        </button>
      </div>

      <div className="progress-bar mt-3">
        <div className="progress-bar-fill" style={{ width: `${project.progress_pct}%` }} />
      </div>

      {expanded && (
        <div className="disclosure-body">
          {filteredProducts.length === 0 && <p className="text-xs text-secondary">Sin productos visibles</p>}
          {filteredProducts.map((product) => (
            <div key={product.product_id} className="sub-item-card">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  onNavigate(`/project/${project.project_id}?productId=${encodeURIComponent(product.product_id)}`)
                }
              >
                <div className="truncate text-xs font-medium text-primary">
                  {product.nombre || "Sin nombre"}
                </div>
                <div className="mt-1 text-[11px] text-secondary">
                  {formatDateLabel(product.fecha_entrega_end || product.fecha_entrega_start)}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {product.tasks_overdue > 0 && (
                  <span className="ui-badge ui-badge--danger">{product.tasks_overdue}</span>
                )}
                <button
                  type="button"
                  className="ui-link"
                  onClick={() => onToggleProduct(product.product_id)}
                >
                  {expandedProducts[product.product_id] ? "Menos" : "Más"}
                </button>
              </div>
              {expandedProducts[product.product_id] && (
                <div className="sub-item-meta">
                  <span>{product.estado || "Sin estado"}</span>
                  <span>·</span>
                  <span>{product.tasks_done}/{product.tasks_total} tareas</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
