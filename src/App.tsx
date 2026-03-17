import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, AuthUser, clearStoredSession, getStoredSession } from "./api/client";
import { ThemeToggle } from "./components/ThemeToggle";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Project } from "./pages/Project";
import { Workload } from "./pages/Workload";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const storedSession = getStoredSession();
  const hasSession = !!storedSession?.token;
  const isLogin = location.pathname === "/login";
  const sectionLabel = location.pathname.startsWith("/project/")
    ? "Proyecto"
    : location.pathname === "/workload"
      ? "Carga"
      : "Panel";
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
      <div className="h-screen overflow-hidden bg-surface text-primary flex items-center justify-center">
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
      <div className="h-screen overflow-hidden bg-surface text-primary">
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
    <div className="h-screen overflow-hidden bg-surface text-primary">
      <div className="mx-auto flex h-full w-full max-w-[1520px] flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        <header className="app-header flex h-14 items-center justify-between px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="app-logo grid h-8 w-8 place-items-center text-[11px] font-semibold">VPF</div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.24em] text-secondary">Workspace</div>
              <div className="truncate text-sm font-semibold text-primary">
                Seguimiento
                <span className="mx-2 text-secondary">/</span>
                <span className="text-secondary">{sectionLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.can_view_workload ? (
              <div className="hidden items-center gap-1 rounded-full border border-border-muted bg-panel px-1 py-1 sm:flex">
                <Link
                  to="/home"
                  className={`rounded-full px-3 py-1 text-[11px] ${location.pathname === "/home" ? "bg-accent text-white" : "text-secondary"}`}
                >
                  Panel
                </Link>
                <Link
                  to="/workload"
                  className={`rounded-full px-3 py-1 text-[11px] ${location.pathname === "/workload" ? "bg-accent text-white" : "text-secondary"}`}
                >
                  Carga
                </Link>
              </div>
            ) : null}
            {currentUser ? (
              <div className="hidden items-center gap-2 rounded-full border border-border-muted bg-panel px-3 py-1 text-[11px] text-secondary sm:flex">
                <span className="font-medium text-primary">{currentUser.display_name}</span>
              </div>
            ) : null}
            <button type="button" className="ui-button ui-button--ghost" onClick={handleLogout}>
              Salir
            </button>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pt-3 sm:pt-4">
          <div key={location.pathname} className="page-transition min-h-full">
            <Routes location={location}>
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home />} />
              <Route path="/project/:projectId" element={<Project currentUser={currentUser} />} />
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
