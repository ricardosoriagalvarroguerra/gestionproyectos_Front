export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue | undefined;
};

export type PersonValue =
  | string
  | {
      id?: string | null;
      name?: string | null;
      full_name?: string | null;
      plain_text?: string | null;
      title?: string | null;
      email?: string | null;
      [key: string]: JsonValue | undefined;
    }
  | PersonValue[]
  | null;

export type Project = {
  project_id: string;
  nombre: string;
  notion_url: string | null;
  area_unidad: JsonValue;
  fase_aprobacion_actual: string | null;
  fecha_start: string | null;
  fecha_end: string | null;
  synced_at: string | null;
  products_total: number;
  products_done?: number;
  tasks_total: number;
  tasks_done?: number;
  tasks_overdue: number;
  progress_pct: number;
  extra_properties?: JsonObject;
};

export type Product = {
  product_id: string;
  nombre: string | null;
  hito?: number | null;
  estado: string | null;
  prioridad: string | null;
  responsable: PersonValue;
  fecha_entrega_start: string | null;
  fecha_entrega_end: string | null;
  notion_url: string | null;
  tasks_total: number;
  tasks_done: number;
  tasks_overdue: number;
  progress_pct: number;
  extra_properties?: JsonObject;
};

export type Task = {
  product_id?: string;
  product_nombre?: string | null;
  product_hito?: number | null;
  task_id: string;
  tarea: string | null;
  hito?: number | null;
  estado: string | null;
  importancia: string | null;
  responsable: PersonValue;
  asignado: PersonValue;
  fecha_start: string | null;
  fecha_end: string | null;
  contraparte: PersonValue;
  notion_url: string | null;
  is_overdue: boolean;
  blocks_other_tasks: boolean;
  is_blocked: boolean;
  extra_properties?: JsonObject;
};

export type TimelineItem = {
  id: string;
  group?: string;
  label: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  progress_pct?: number;
  is_overdue?: boolean;
};

export type TimelineResponse = {
  mode: "products" | "tasks";
  product_id?: string;
  groups: { id: string; label: string }[];
  items: TimelineItem[];
};

export type DashboardResponse = {
  kpis: {
    project_id: string;
    nombre: string | null;
    products_total: number;
    products_done: number;
    tasks_total: number;
    tasks_done: number;
    tasks_overdue: number;
    progress_pct: number;
  };
  overdue_tasks: JsonObject[];
  upcoming_tasks: JsonObject[];
  products_in_review: JsonObject[];
};

export type HomeAlert = {
  project_id: string;
  project_nombre: string | null;
  product_id: string | null;
  product_nombre: string | null;
  task_id: string;
  tarea: string | null;
  estado: string | null;
  importancia: string | null;
  fecha_start: string | null;
  fecha_end: string | null;
  alert_type: "overdue" | "upcoming";
};

export type HomeOverviewResponse = {
  projects: Project[];
  alerts: HomeAlert[];
  project_products: Record<string, Product[]>;
};

export type AuthScope = {
  projects: number;
  products: number;
  tasks: number;
};

export type AuthUser = {
  user_key: string;
  display_name: string;
  can_view_workload?: boolean;
  can_view_all?: boolean;
  scope: AuthScope;
  expires_at?: string | null;
};

export type AuthLoginUser = {
  user_key: string;
  display_name: string;
};

export type AuthLoginResponse = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

export type SyncProvisionedUser = {
  user_key: string;
  display_name: string;
  temporary_password: string;
  can_view_workload: boolean;
};

export type WorkloadWeek = {
  id: string;
  index: number;
  label: string;
  range_label: string;
  start: string;
  end: string;
};

export type WorkloadCell = {
  week_id: string;
  projects: number;
  products: number;
  tasks: number;
  total: number;
  project_names: string[];
  product_names: string[];
  task_names: string[];
};

export type WorkloadUserRow = {
  user_key: string;
  display_name: string;
  can_login: boolean;
  totals: {
    projects: number;
    products: number;
    tasks: number;
    total: number;
  };
  weeks: WorkloadCell[];
};

export type WorkloadOverviewResponse = {
  year: number;
  month: number;
  label: string;
  weeks: WorkloadWeek[];
  users: WorkloadUserRow[];
  summary: {
    users: number;
    projects: number;
    products: number;
    tasks: number;
    total: number;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const AUTH_STORAGE_KEY = "vpf-auth-session";

export function getStoredSession(): AuthLoginResponse | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthLoginResponse;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AuthLoginResponse) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getStoredToken(): string | null {
  return getStoredSession()?.token || null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (res.status === 401) {
    clearStoredSession();
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export const api = {
  authUsers: async () => {
    try {
      return await apiFetch<{ users: AuthLoginUser[] }>("/api/auth/users");
    } catch (error) {
      if (error instanceof Error && /API error (403|404):/.test(error.message)) {
        return { users: [] };
      }
      throw error;
    }
  },
  login: (payload: { user_key: string; password: string }) =>
    apiFetch<AuthLoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => apiFetch<AuthUser>("/api/auth/me"),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  sync: () =>
    apiFetch<{ counts: Record<string, number>; duration_seconds: number; new_login_users?: SyncProvisionedUser[] }>(
      "/api/sync",
      { method: "POST" }
    ),
  home: () => apiFetch<HomeOverviewResponse>("/api/home"),
  projects: () => apiFetch<Project[]>("/api/projects"),
  projectProducts: (projectId: string) => apiFetch<Product[]>(`/api/projects/${projectId}/products`),
  projectTasks: (projectId: string) => apiFetch<Task[]>(`/api/projects/${projectId}/tasks`),
  productTasks: (productId: string) => apiFetch<Task[]>(`/api/products/${productId}/tasks`),
  projectDashboard: (projectId: string) => apiFetch<DashboardResponse>(`/api/projects/${projectId}/dashboard`),
  workload: (year: number, month: number) =>
    apiFetch<WorkloadOverviewResponse>(`/api/workload?year=${year}&month=${month}`),
  timeline: (projectId: string, mode: string, productId?: string) => {
    const params = new URLSearchParams({ mode });
    if (productId) params.append("product_id", productId);
    return apiFetch<TimelineResponse>(`/api/projects/${projectId}/timeline?${params.toString()}`);
  },
};
