import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import {
  api,
  AuthUser,
  CanvasEdge,
  CanvasGranularity,
  CanvasMultiResponse,
  CanvasNode,
  CanvasResponse,
  CanvasUserOption,
} from "../api/client";

type GraphNode = CanvasNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type GraphLink = Omit<CanvasEdge, "source" | "target"> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

function nodeId(ref: string | GraphNode): string {
  return typeof ref === "string" ? ref : ref.id;
}

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type ResolvedTheme = "dark" | "light";

type Palette = {
  background: string;
  user: { fill: string; glow: string };
  other: { fill: string; glow: string };
  link: string;
  particle: string;
  labelActive: string;
  labelDim: string;
  hoverStroke: string;
  linkDim: string;
};

// User: red (#c1121f) in both themes.
// Other nodes: white in dark, black in light.
const USER_RED = "#c1121f";
const USER_RED_GLOW = "rgba(193, 18, 31, 0.55)";

const DARK_PALETTE: Palette = {
  background: "#000000",
  user: { fill: USER_RED, glow: USER_RED_GLOW },
  other: { fill: "#ffffff", glow: "rgba(255, 255, 255, 0.32)" },
  link: "rgba(255, 255, 255, 0.22)",
  linkDim: "rgba(255, 255, 255, 0.04)",
  particle: "rgba(255, 255, 255, 0.7)",
  labelActive: "rgba(240, 240, 245, 0.92)",
  labelDim: "rgba(160, 160, 170, 0.32)",
  hoverStroke: "rgba(255, 255, 255, 0.85)",
};

const LIGHT_PALETTE: Palette = {
  background: "#ffffff",
  user: { fill: USER_RED, glow: USER_RED_GLOW },
  other: { fill: "#0a0a0a", glow: "rgba(10, 10, 10, 0.28)" },
  link: "rgba(10, 10, 10, 0.28)",
  linkDim: "rgba(10, 10, 10, 0.05)",
  particle: "rgba(10, 10, 10, 0.6)",
  labelActive: "rgba(10, 10, 10, 0.85)",
  labelDim: "rgba(82, 82, 91, 0.35)",
  hoverStroke: "rgba(10, 10, 10, 0.85)",
};

function resolveThemeFromDom(): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveThemeFromDom());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setTheme(resolveThemeFromDom());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  return theme;
}

function nodeBaseRadius(node: GraphNode): number {
  if (node.type === "user") return 14;
  if (node.type === "project") return 9;
  if (node.type === "product") return 7;
  return 5; // task
}

function nodeColor(node: GraphNode, palette: Palette): { fill: string; glow: string } {
  if (node.type === "user") return palette.user;
  return palette.other;
}

const GRANULARITY_OPTIONS: { value: CanvasGranularity; label: string; help: string }[] = [
  { value: "projects", label: "Solo proyectos", help: "Usuario y proyectos" },
  { value: "products", label: "Proyectos y productos", help: "Hasta nivel de productos" },
  { value: "tasks", label: "Proyectos, productos y tareas", help: "Vista completa" },
];

export function Canvas({ currentUser }: { currentUser: AuthUser | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Selected user keys: single-user (length 1) is the default; admins can pick many.
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<CanvasGranularity>("products");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const resolvedTheme = useResolvedTheme();
  const palette = resolvedTheme === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  const isAdmin = !!currentUser?.can_view_all;

  // Default to the current user when nothing is picked.
  const effectiveUserKeys = useMemo<string[]>(() => {
    if (selectedUserKeys.length > 0) return selectedUserKeys;
    return currentUser?.user_key ? [currentUser.user_key] : [];
  }, [selectedUserKeys, currentUser?.user_key]);

  const isMulti = effectiveUserKeys.length > 1;

  const usersQuery = useQuery<{ users: CanvasUserOption[] }>({
    queryKey: ["canvas", "users"],
    queryFn: api.canvasUsers,
    enabled: isAdmin,
  });

  const canvasQuery = useQuery<CanvasResponse | CanvasMultiResponse>({
    queryKey: ["canvas", effectiveUserKeys.join(","), granularity, isMulti ? "multi" : "single"],
    queryFn: () => {
      if (isMulti) {
        return api.canvasMulti(effectiveUserKeys, granularity);
      }
      const [single] = effectiveUserKeys;
      return api.canvas(single === currentUser?.user_key ? undefined : single, granularity);
    },
    enabled: effectiveUserKeys.length > 0,
  });

  // Resize handler so the graph follows the canvas container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setDimensions({ w: Math.max(320, rect.width), h: Math.max(360, rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Re-measure when sidebar collapses/expands so the graph fills the new width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setDimensions({ w: Math.max(320, rect.width), h: Math.max(360, rect.height) });
    }, 320); // wait for the CSS transition
    return () => window.clearTimeout(t);
  }, [sidebarOpen]);

  const graphData = useMemo<GraphData>(() => {
    const data = canvasQuery.data;
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.edges.map((edge) => ({ ...edge })),
    };
  }, [canvasQuery.data]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    graphData.links.forEach((link) => {
      const s = nodeId(link.source);
      const t = nodeId(link.target);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    });
    return map;
  }, [graphData]);

  const isFocused = (id: string) => {
    if (!hoveredId) return true;
    if (hoveredId === id) return true;
    return adjacency.get(hoveredId)?.has(id) ?? false;
  };

  const isLinkActive = (link: GraphLink) => {
    if (!hoveredId) return true;
    return nodeId(link.source) === hoveredId || nodeId(link.target) === hoveredId;
  };

  // Tune force layout so nodes spread out without flying off the viewport.
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    type Adjustable = {
      strength?: (s: number) => unknown;
      distance?: (d: number) => unknown;
    };
    const charge = fg.d3Force("charge") as unknown as Adjustable | undefined;
    if (charge && typeof charge.strength === "function") {
      // Strength scales inversely with node count so dense graphs don't blow up.
      const n = Math.max(1, graphData.nodes.length);
      const base = granularity === "tasks" ? -260 : granularity === "products" ? -360 : -450;
      const scaled = base * Math.min(1.5, Math.max(0.6, 24 / Math.sqrt(n)));
      charge.strength(scaled);
    }
    const link = fg.d3Force("link") as unknown as Adjustable | undefined;
    if (link && typeof link.distance === "function") {
      const distance = granularity === "tasks" ? 130 : granularity === "products" ? 180 : 240;
      link.distance(distance);
    }
    if (graphData.nodes.length > 0) {
      fg.d3ReheatSimulation?.();
      const t = window.setTimeout(() => fg.zoomToFit?.(700, 140), 200);
      return () => window.clearTimeout(t);
    }
  }, [graphData.nodes.length, granularity]);

  const handleNodeClick = (node: GraphNode) => {
    if (node.notion_url) {
      window.open(node.notion_url, "_blank", "noopener,noreferrer");
      return;
    }
    const fg = graphRef.current;
    if (fg && typeof node.x === "number" && typeof node.y === "number") {
      fg.centerAt(node.x, node.y, 600);
      fg.zoom(2.5, 600);
    }
  };

  const drawNode = (
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    // Skip nodes whose coords haven't been initialized (NaN/Infinity/undefined).
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const x = node.x as number;
    const y = node.y as number;
    const baseRadius = nodeBaseRadius(node);
    const focused = isFocused(node.id);
    const isHover = hoveredId === node.id;
    const radius = baseRadius * (isHover ? 1.25 : 1);
    const colors = nodeColor(node, palette);
    const alpha = focused ? 1 : 0.18;

    if (focused) {
      const grad = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius * 3.4);
      grad.addColorStop(0, colors.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.4, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    if (isHover) {
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = palette.hoverStroke;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const label = node.label || "—";
    const fontSize =
      node.type === "user" ? 13 / globalScale : node.type === "task" ? 9 / globalScale : 10 / globalScale;
    ctx.font = `${node.type === "user" ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = focused ? palette.labelActive : palette.labelDim;
    const truncated = label.length > 36 ? `${label.slice(0, 33)}…` : label;
    ctx.fillText(truncated, x, y + radius + 4 / globalScale);
  };

  const linkColor = (link: GraphLink): string => {
    if (!hoveredId) return palette.link;
    return isLinkActive(link) ? palette.link : palette.linkDim;
  };

  const linkWidth = (link: GraphLink): number => (isLinkActive(link) ? 1.4 : 0.5);

  const handleNodeHover = (node: GraphNode | null) => {
    setHoveredId(node ? node.id : null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? "pointer" : "default";
    }
  };

  const summary = canvasQuery.data?.summary;
  const allUserOptions = usersQuery.data?.users || [];
  const userLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    if (currentUser) map.set(currentUser.user_key, currentUser.display_name);
    allUserOptions.forEach((u) => map.set(u.user_key, u.display_name));
    return map;
  }, [allUserOptions, currentUser]);

  const targetUserLabel = isMulti
    ? `${effectiveUserKeys.length} usuarios`
    : userLabelByKey.get(effectiveUserKeys[0] || "") || effectiveUserKeys[0] || "—";

  const toggleUserSelection = (userKey: string) => {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev.length > 0 ? prev : currentUser?.user_key ? [currentUser.user_key] : []);
      if (next.has(userKey)) {
        next.delete(userKey);
      } else {
        next.add(userKey);
      }
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedUserKeys([]);

  const resetView = () => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.zoomToFit?.(700, 140);
  };

  // Re-seat all nodes: user nodes on a circle, others around their connected users.
  // Then reheat the simulation so d3 settles into a clean layout.
  const reorganize = () => {
    const fg = graphRef.current;
    if (!fg) return;
    const nodes = graphData.nodes;
    if (nodes.length === 0) return;

    const userNodes = nodes.filter((n) => n.type === "user");
    const otherNodes = nodes.filter((n) => n.type !== "user");
    const userCount = Math.max(1, userNodes.length);
    const ringRadius = Math.max(200, 90 * userCount);

    // Distribute user nodes evenly around a circle.
    userNodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / userCount - Math.PI / 2;
      n.x = Math.cos(angle) * ringRadius;
      n.y = Math.sin(angle) * ringRadius;
      n.vx = 0;
      n.vy = 0;
    });

    const userPosById = new Map<string, { x: number; y: number }>();
    userNodes.forEach((n) => {
      if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
        userPosById.set(n.id, { x: n.x as number, y: n.y as number });
      }
    });

    // Place each non-user near the centroid of its connected user nodes.
    otherNodes.forEach((n) => {
      const neighbors = adjacency.get(n.id);
      let sumX = 0;
      let sumY = 0;
      let cnt = 0;
      if (neighbors) {
        neighbors.forEach((id) => {
          const p = userPosById.get(id);
          if (p) {
            sumX += p.x;
            sumY += p.y;
            cnt += 1;
          }
        });
      }
      const jitter = () => (Math.random() - 0.5) * 100;
      if (cnt > 0) {
        n.x = sumX / cnt + jitter();
        n.y = sumY / cnt + jitter();
      } else {
        n.x = (Math.random() - 0.5) * ringRadius * 1.6;
        n.y = (Math.random() - 0.5) * ringRadius * 1.6;
      }
      n.vx = 0;
      n.vy = 0;
    });

    fg.d3ReheatSimulation?.();
    window.setTimeout(() => fg.zoomToFit?.(700, 140), 900);
  };

  return (
    <div className="canvas-shell">
      <aside className={`canvas-sidebar ${sidebarOpen ? "is-open" : "is-closed"}`}>
        <div className="canvas-sidebar-inner">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.28em] text-secondary">Network view</p>
            <h1 className="text-[24px] leading-tight font-semibold">Canvas</h1>
          </div>

          <p className="text-[12px] leading-5 text-secondary">
            Grafo estilo Obsidian: tu nodo central conectado a proyectos, productos y tareas.
            Hover para resaltar conexiones, click para abrir en Notion, drag para reordenar.
          </p>

          <div className="canvas-sidebar-section">
            <div className="canvas-sidebar-heading">Granularidad</div>
            <div className="canvas-granularity">
              {GRANULARITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`canvas-granularity-option ${granularity === opt.value ? "is-active" : ""}`}
                  title={opt.help}
                >
                  <input
                    type="radio"
                    name="canvas-granularity"
                    value={opt.value}
                    checked={granularity === opt.value}
                    onChange={() => setGranularity(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {isAdmin ? (
            <div className="canvas-sidebar-section">
              <div className="canvas-sidebar-heading flex items-center justify-between">
                <span>Usuarios visibles</span>
                {effectiveUserKeys.length > 1 ? (
                  <button
                    type="button"
                    className="text-[10px] text-secondary hover:text-primary"
                    onClick={clearSelection}
                  >
                    Solo yo
                  </button>
                ) : null}
              </div>
              <div className="canvas-user-list">
                {currentUser ? (
                  <label
                    className={`canvas-user-row ${effectiveUserKeys.includes(currentUser.user_key) ? "is-active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={effectiveUserKeys.includes(currentUser.user_key)}
                      onChange={() => toggleUserSelection(currentUser.user_key)}
                    />
                    <span className="truncate">{currentUser.display_name} (yo)</span>
                  </label>
                ) : null}
                {allUserOptions
                  .filter((u) => u.user_key !== currentUser?.user_key)
                  .map((user) => {
                    const checked = effectiveUserKeys.includes(user.user_key);
                    return (
                      <label
                        key={user.user_key}
                        className={`canvas-user-row ${checked ? "is-active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUserSelection(user.user_key)}
                        />
                        <span className="truncate">
                          {user.display_name}
                          {user.can_view_all ? <span className="text-secondary"> · admin</span> : null}
                        </span>
                      </label>
                    );
                  })}
              </div>
              <p className="text-[10px] text-secondary">
                Tildá varios para ver cómo se interconectan entre sí.
              </p>
            </div>
          ) : null}

          <div className="canvas-sidebar-section">
            <div className="canvas-sidebar-heading">Resumen</div>
            {summary ? (
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between text-secondary">
                  <span>{isMulti ? "Usuarios" : "Usuario"}</span>
                  <span className="text-primary truncate ml-2">{targetUserLabel}</span>
                </div>
                <div className="flex justify-between text-secondary">
                  <span>Proyectos</span>
                  <span className="text-primary">{summary.projects}</span>
                </div>
                {granularity !== "projects" ? (
                  <div className="flex justify-between text-secondary">
                    <span>Productos</span>
                    <span className="text-primary">{summary.products}</span>
                  </div>
                ) : null}
                {granularity === "tasks" ? (
                  <div className="flex justify-between text-secondary">
                    <span>Tareas</span>
                    <span className="text-primary">{summary.tasks}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-secondary">
                  <span>Conexiones</span>
                  <span className="text-primary">{summary.edges}</span>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-secondary">—</div>
            )}
          </div>

          <div className="canvas-sidebar-section">
            <div className="canvas-sidebar-heading">Navegación</div>
            <p className="text-[11px] text-secondary leading-5">
              Arrastrá un área vacía para mover el grafo. Scroll para zoom. Drag sobre un nodo para moverlo.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" className="canvas-mini-button" onClick={reorganize}>
                Reorganizar nodos
              </button>
              <button type="button" className="canvas-mini-button" onClick={resetView}>
                Centrar y ajustar zoom
              </button>
            </div>
          </div>

          <div className="canvas-sidebar-section">
            <div className="canvas-sidebar-heading">Leyenda</div>
            <div className="space-y-1.5 text-[12px] text-secondary">
              <span className="canvas-legend-item">
                <span className="canvas-legend-dot" style={{ background: palette.user.fill }} />
                Usuario
              </span>
              <span className="canvas-legend-item">
                <span className="canvas-legend-dot" style={{ background: palette.other.fill }} />
                Proyecto / Producto / Tarea
              </span>
            </div>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="canvas-sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
        title={sidebarOpen ? "Colapsar" : "Expandir"}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidebarOpen ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
        </svg>
      </button>

      <section className="canvas-stage" style={{ background: palette.background }}>
        <div ref={containerRef} className="absolute inset-0">
          {canvasQuery.isLoading ? (
            <div
              className="absolute inset-0 grid place-items-center text-sm"
              style={{ color: resolvedTheme === "light" ? "#52525b" : "rgba(220,220,230,0.7)" }}
            >
              Cargando grafo...
            </div>
          ) : canvasQuery.isError ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-red-400">
              No se pudo cargar el canvas.
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div
              className="absolute inset-0 grid place-items-center text-sm"
              style={{ color: resolvedTheme === "light" ? "#52525b" : "rgba(220,220,230,0.7)" }}
            >
              No hay proyectos visibles para este usuario.
            </div>
          ) : (
            <ForceGraph2D<GraphNode, GraphLink>
              ref={graphRef}
              graphData={graphData}
              width={dimensions.w}
              height={dimensions.h}
              backgroundColor={palette.background}
              cooldownTicks={150}
              cooldownTime={6000}
              d3AlphaDecay={0.035}
              d3VelocityDecay={0.5}
              warmupTicks={20}
              nodeRelSize={6}
              minZoom={0.2}
              maxZoom={6}
              nodeCanvasObject={drawNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={(node, color, ctx) => {
                const x = node.x;
                const y = node.y;
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x as number, y as number, nodeBaseRadius(node) + 4, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkDirectionalParticles={(link) => (isLinkActive(link) ? 2 : 1)}
              linkDirectionalParticleSpeed={() => 0.0035}
              linkDirectionalParticleWidth={(link) => (isLinkActive(link) ? 2 : 1.1)}
              linkDirectionalParticleColor={() => palette.particle}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => setHoveredId(null)}
              enableZoomInteraction
              enablePanInteraction
              enableNodeDrag
            />
          )}
        </div>
      </section>
    </div>
  );
}
