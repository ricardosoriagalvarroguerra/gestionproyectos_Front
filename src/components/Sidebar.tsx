import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, AuthUser, Project } from "../api/client";

const Icon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const paths: Record<string, JSX.Element> = {
    search: (
      <>
        <circle cx="7.5" cy="7.5" r="4.5" />
        <path d="m11 11 3 3" />
      </>
    ),
    home: (
      <>
        <path d="M3 9 9 4l6 5v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
        <path d="M7 16v-4h4v4" />
      </>
    ),
    graph: (
      <>
        <circle cx="9" cy="9" r="2" />
        <circle cx="3" cy="3" r="1.5" />
        <circle cx="15" cy="3" r="1.5" />
        <circle cx="3" cy="15" r="1.5" />
        <circle cx="15" cy="15" r="1.5" />
        <path d="M7.5 7.5 4 4M10.5 7.5 14 4M7.5 10.5 4 14M10.5 10.5 14 14" />
      </>
    ),
    chart: <path d="M3 14V9M7.5 14V5M12 14v-3M3 16h12.5" />,
    folder: <path d="M2.5 5a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5Z" />,
    file: (
      <>
        <path d="M4 2.5h6L13.5 6v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Z" />
        <path d="M10 2.5V6h3.5" />
      </>
    ),
    caret: <path d="m6 4 4 4-4 4" />,
    bell: (
      <>
        <path d="M5 12a4 4 0 0 1 8 0v2H5v-2ZM7.5 14v.5a1.5 1.5 0 0 0 3 0V14" />
        <path d="M9 4V2.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="9" cy="9" r="2" />
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.5 1.5M12.5 12.5 14 14M4 14l1.5-1.5M12.5 5.5 14 4" />
      </>
    ),
    layers: (
      <>
        <path d="M9 2 2.5 5.5 9 9l6.5-3.5L9 2Z" />
        <path d="M2.5 9.5 9 13l6.5-3.5M2.5 12.5 9 16l6.5-3.5" />
      </>
    ),
    logout: (
      <>
        <path d="M11 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1" />
        <path d="M7 9h9m0 0-2.5-2.5M16 9l-2.5 2.5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
};

type SidebarProps = {
  currentUser: AuthUser | null;
  onLogout: () => void;
};

export function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedProjectId = location.pathname.startsWith("/project/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : null;

  const [open, setOpen] = useState<{ proyectos: boolean }>({ proyectos: true });
  const projectsQuery = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: api.projects,
    enabled: !!currentUser,
  });
  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);

  const isActive = (path: string) => location.pathname === path;
  const showWorkload = !!currentUser?.can_view_workload;

  return (
    <aside className="gp-sidebar scrollbar-thin">
      <div className="gp-ws">
        <span className="gp-ws-badge">VPF</span>
        <span className="gp-ws-meta gp-truncate">
          <b>Seguimiento</b>
          <span>Workspace</span>
        </span>
      </div>

      <button type="button" className="gp-item" onClick={() => undefined}>
        <span className="caret" style={{ visibility: "hidden" }} />
        <span className="ico"><Icon name="search" size={14} /></span>
        <span className="lbl gp-muted" style={{ fontSize: 13 }}>Buscar</span>
        <span className="meta">⌘K</span>
      </button>

      <button
        type="button"
        className={`gp-item ${isActive("/home") ? "active" : ""}`}
        onClick={() => navigate("/home")}
      >
        <span className="caret" style={{ visibility: "hidden" }} />
        <span className="ico"><Icon name="home" size={15} /></span>
        <span className="lbl">Panel</span>
      </button>
      <button
        type="button"
        className={`gp-item ${isActive("/canvas") ? "active" : ""}`}
        onClick={() => navigate("/canvas")}
      >
        <span className="caret" style={{ visibility: "hidden" }} />
        <span className="ico"><Icon name="graph" size={15} /></span>
        <span className="lbl">Canvas</span>
      </button>
      {showWorkload && (
        <button
          type="button"
          className={`gp-item ${isActive("/workload") ? "active" : ""}`}
          onClick={() => navigate("/workload")}
        >
          <span className="caret" style={{ visibility: "hidden" }} />
          <span className="ico"><Icon name="chart" size={15} /></span>
          <span className="lbl">Carga</span>
        </button>
      )}

      <div className="gp-section">Proyectos</div>
      <button
        type="button"
        className={`gp-item ${open.proyectos ? "open" : ""}`}
        onClick={() => setOpen((o) => ({ ...o, proyectos: !o.proyectos }))}
      >
        <span className="caret"><Icon name="caret" size={12} /></span>
        <span className="ico"><Icon name="folder" size={14} /></span>
        <span className="lbl">Todos</span>
        <span className="meta">{projects.length}</span>
      </button>
      {open.proyectos && (
        <div className="gp-children">
          {projectsQuery.isLoading && (
            <div className="gp-item" style={{ color: "var(--text-muted)" }}>
              <span className="caret" style={{ visibility: "hidden" }} />
              <span className="lbl">Cargando…</span>
            </div>
          )}
          {!projectsQuery.isLoading && projects.length === 0 && (
            <div className="gp-item" style={{ color: "var(--text-muted)" }}>
              <span className="caret" style={{ visibility: "hidden" }} />
              <span className="lbl">Sin proyectos</span>
            </div>
          )}
          {projects.map((p) => (
            <Link
              key={p.project_id}
              to={`/project/${p.project_id}`}
              className={`gp-item ${selectedProjectId === p.project_id ? "active" : ""}`}
              title={p.nombre || ""}
            >
              <span className="caret" style={{ visibility: "hidden" }} />
              <span className="ico"><Icon name="file" size={13} /></span>
              <span className="lbl">{p.nombre || "Sin nombre"}</span>
              {p.tasks_overdue > 0 && (
                <span className="gp-pill danger" style={{ height: 18, padding: "0 6px" }}>
                  {p.tasks_overdue}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="gp-sidebar-spacer" />

      <div className="gp-section" style={{ paddingTop: 8 }}>Cuenta</div>
      {currentUser && (
        <div className="gp-item" style={{ cursor: "default" }}>
          <span className="caret" style={{ visibility: "hidden" }} />
          <span className="ico"><Icon name="settings" size={14} /></span>
          <span className="lbl gp-truncate">{currentUser.display_name}</span>
        </div>
      )}
      <button type="button" className="gp-item" onClick={onLogout}>
        <span className="caret" style={{ visibility: "hidden" }} />
        <span className="ico"><Icon name="logout" size={14} /></span>
        <span className="lbl">Salir</span>
      </button>
    </aside>
  );
}
