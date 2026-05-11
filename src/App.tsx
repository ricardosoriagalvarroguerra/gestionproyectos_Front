import { lazy, Suspense, useEffect, useMemo } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, AuthUser, Project, clearStoredSession, getStoredSession } from "./api/client";
import { ThemeToggle } from "./components/ThemeToggle";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Project as ProjectPage } from "./pages/Project";
import { Workload } from "./pages/Workload";

// Code-split the Canvas page (it pulls in react-force-graph-2d ~600KB).
const Canvas = lazy(() => import("./pages/Canvas").then((m) => ({ default: m.Canvas })));

function Breadcrumb({ currentUser }: { currentUser: AuthUser | null }) {
  const location = useLocation();
  const projectsQuery = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: api.projects,
    enabled: !!currentUser,
  });

  const items = useMemo(() => {
    const path = location.pathname;
    if (path === "/home") return [{ label: "Seguimiento" }, { label: "Panel" }];
    if (path === "/canvas") return [{ label: "Seguimiento" }, { label: "Canvas" }];
    if (path === "/workload") return [{ label: "Seguimiento" }, { label: "Carga" }];
    if (path.startsWith("/project/")) {
      const projectId = decodeURIComponent(path.split("/")[2] || "");
      const project = projectsQuery.data?.find((p) => p.project_id === projectId);
      return [
        { label: "Seguimiento" },
        { label: "Proyectos", href: "/home" },
        { label: project?.nombre || "Proyecto" },
      ];
    }
    return [{ label: "Seguimiento" }];
  }, [location.pathname, projectsQuery.data]);

  return (
    <div className="gp-crumb">
      {items.map((c, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span className="sep">/</span>}
          {c.href ? (
            <Link to={c.href}>{c.label}</Link>
          ) : (
            <span className={i === items.length - 1 ? "here" : ""}>{c.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const storedSession = getStoredSession();
  const hasSession = !!storedSession?.token;
  const isLogin = location.pathname === "/login";

  const meQuery = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    enabled: hasSession,
    retry: false,
  });

  useEffect(() => {
    if (!meQuery.isError) return;
    clearStoredSession();
    navigate("/login", { replace: true });
  }, [meQuery.isError, navigate]);

  const currentUser = meQuery.data || storedSession?.user || null;

  if (location.pathname === "/") {
    return <Navigate to={hasSession ? "/home" : "/login"} replace />;
  }

  if (!isLogin && !hasSession) {
    return <Navigate to="/login" replace />;
  }

  if (isLogin && hasSession) {
    return <Navigate to="/home" replace />;
  }

  if (hasSession && meQuery.isLoading && !currentUser) {
    return (
      <div className="app-viewport overflow-hidden bg-surface text-primary flex items-center justify-center">
        <div className="glass px-6 py-5 text-sm text-secondary">Validando acceso...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // The local session must be cleared even if the server already dropped it.
    } finally {
      clearStoredSession();
      navigate("/login", { replace: true });
    }
  };

  if (isLogin) {
    return (
      <div className="app-viewport overflow-hidden bg-surface text-primary">
        <div className="flex h-full w-full items-center justify-center px-4 py-6 sm:px-6">
          <div key={location.pathname} className="page-transition flex h-full w-full items-center justify-center">
            <Routes location={location}>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-viewport bg-surface text-primary">
      <div className="app-shell">
        <Sidebar currentUser={currentUser} onLogout={handleLogout} />
        <main className="gp-main">
          <div className="gp-topbar">
            <Breadcrumb currentUser={currentUser} />
            <div className="gp-spacer" />
            <ThemeToggle />
            {currentUser && (
              <span className="gp-user-chip">
                <span className="gp-avatar color-1">
                  {(currentUser.display_name || "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="gp-truncate" style={{ maxWidth: 140 }}>
                  {currentUser.display_name.split(" ")[0]}
                </span>
              </span>
            )}
          </div>
          <div key={location.pathname} className="page-transition" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <Routes location={location}>
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home currentUser={currentUser} />} />
              <Route
                path="/canvas"
                element={
                  <Suspense
                    fallback={
                      <div className="gp-content" style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "var(--text-secondary)" }}>
                        Cargando canvas...
                      </div>
                    }
                  >
                    <Canvas currentUser={currentUser} />
                  </Suspense>
                }
              />
              <Route path="/project/:projectId" element={<ProjectPage currentUser={currentUser} />} />
              <Route
                path="/workload"
                element={
                  currentUser?.can_view_workload ? <Workload currentUser={currentUser} /> : <Navigate to="/home" replace />
                }
              />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
