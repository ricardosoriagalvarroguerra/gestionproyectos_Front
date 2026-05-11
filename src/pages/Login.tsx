import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, setStoredSession } from "../api/client";

export function Login() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["auth", "users"],
    queryFn: api.authUsers,
    retry: false,
  });
  const users = data?.users || [];
  const [userKey, setUserKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const session = await api.login({ user_key: userKey, password });
      setStoredSession(session);
      navigate("/home", { replace: true });
    } catch {
      setError("No se pudo iniciar sesión. Verifica la contraseña temporal.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[440px] items-center justify-center">
      <section
        className="w-full"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-muted)",
          borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        <div className="gp-row" style={{ gap: 10, marginBottom: 18 }}>
          <span
            className="app-logo"
            style={{ width: 28, height: 28, display: "grid", placeItems: "center", fontSize: 11 }}
          >
            VPF
          </span>
          <div>
            <div className="page-eyebrow">Workspace</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Seguimiento</div>
          </div>
        </div>
        <h2 className="page-title" style={{ fontSize: 24, margin: "8px 0 4px" }}>
          Ingreso interno
        </h2>
        <p className="page-subtitle" style={{ marginBottom: 24 }}>
          Acceso al panel de gestión de proyectos.
        </p>
        <form onSubmit={submit} className="gp-vstack" style={{ gap: 16 }}>
          <label className="gp-vstack" style={{ gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
              Usuario o nombre
            </span>
            <input
              type="text"
              list={users.length ? "login-users" : undefined}
              className="ui-input"
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              placeholder="Ej. ricardo soria galvarro"
              autoComplete="username"
            />
            {users.length ? (
              <datalist id="login-users">
                {users.map((user) => (
                  <option key={user.user_key} value={user.user_key}>
                    {user.display_name}
                  </option>
                ))}
              </datalist>
            ) : null}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Puedes escribir tu user_key aunque el directorio público esté deshabilitado.
            </span>
          </label>
          <label className="gp-vstack" style={{ gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
              Contraseña
            </span>
            <input
              type="password"
              className="ui-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña temporal"
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-text)",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
          <button type="submit" className="ui-button ui-button--primary" style={{ width: "100%" }}>
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
