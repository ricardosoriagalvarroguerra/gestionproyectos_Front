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
    <div className="mx-auto flex w-full max-w-[560px] items-center justify-center">
      <section className="glass w-full px-7 py-8 sm:px-8 sm:py-9">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.28em] text-secondary">Acceso</div>
          <h2 className="text-[28px] leading-none font-semibold sm:text-[32px]">Ingreso interno</h2>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block space-y-2 text-sm text-secondary">
            <span className="block font-medium text-primary">Usuario o nombre</span>
            <input
              type="text"
              list={users.length ? "login-users" : undefined}
              className="ui-input w-full"
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
            <span className="block text-xs text-secondary">
              Puedes escribir tu `user_key` aunque el directorio público esté deshabilitado.
            </span>
          </label>
          <label className="block space-y-2 text-sm text-secondary">
            <span className="block font-medium text-primary">Contraseña</span>
            <input
              type="password"
              className="ui-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña temporal"
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div className="rounded-xl border border-[rgba(226,85,85,0.24)] bg-[rgba(226,85,85,0.08)] px-3 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : null}
          <button type="submit" className="ui-button ui-button--primary w-full">
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
