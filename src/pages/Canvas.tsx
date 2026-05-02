import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import {
  api,
  AuthUser,
  CanvasEdge,
  CanvasNode,
  CanvasResponse,
  CanvasUserOption,
} from "../api/client";

type GraphNode = CanvasNode & {
  // d3-force runtime fields injected by react-force-graph
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

const NODE_COLORS = {
  user: { fill: "#7c5cff", glow: "rgba(124, 92, 255, 0.45)" },
  userAdmin: { fill: "#ff7eb6", glow: "rgba(255, 126, 182, 0.5)" },
  project: { fill: "#2383e2", glow: "rgba(35, 131, 226, 0.4)" },
  product: { fill: "#3ec78b", glow: "rgba(62, 199, 139, 0.4)" },
} as const;

const LINK_COLORS = {
  user_project: "rgba(124, 92, 255, 0.55)",
  user_product: "rgba(124, 92, 255, 0.35)",
  project_product: "rgba(35, 131, 226, 0.45)",
} as const;

function nodeBaseRadius(node: GraphNode): number {
  if (node.type === "user") return 14;
  if (node.type === "project") return 9;
  return 6;
}

function nodeColor(node: GraphNode): { fill: string; glow: string } {
  if (node.type === "user") {
    return node.is_admin ? NODE_COLORS.userAdmin : NODE_COLORS.user;
  }
  if (node.type === "project") return NODE_COLORS.project;
  return NODE_COLORS.product;
}

export function Canvas({ currentUser }: { currentUser: AuthUser | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

  const isAdmin = !!currentUser?.can_view_all;
  const targetUserKey = selectedUserKey || currentUser?.user_key || null;

  const usersQuery = useQuery<{ users: CanvasUserOption[] }>({
    queryKey: ["canvas", "users"],
    queryFn: api.canvasUsers,
    enabled: isAdmin,
  });

  const canvasQuery = useQuery<CanvasResponse>({
    queryKey: ["canvas", targetUserKey],
    queryFn: () => api.canvas(targetUserKey === currentUser?.user_key ? undefined : targetUserKey || undefined),
    enabled: !!targetUserKey,
  });

  // Resize handler so the graph follows the container size.
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

  const graphData = useMemo<GraphData>(() => {
    const data = canvasQuery.data;
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.edges.map((edge) => ({ ...edge })),
    };
  }, [canvasQuery.data]);

  // Map for hover-based highlighting (Obsidian-like dim-others-on-hover).
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

  const isFocused = (nodeId: string) => {
    if (!hoveredId) return true;
    if (hoveredId === nodeId) return true;
    return adjacency.get(hoveredId)?.has(nodeId) ?? false;
  };

  const isLinkActive = (link: GraphLink) => {
    if (!hoveredId) return true;
    return nodeId(link.source) === hoveredId || nodeId(link.target) === hoveredId;
  };

  // Re-fit and tune forces when data loads or container size changes.
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    type Adjustable = {
      strength?: (s: number) => unknown;
      distance?: (d: number) => unknown;
    };
    const charge = fg.d3Force("charge") as unknown as Adjustable | undefined;
    if (charge && typeof charge.strength === "function") {
      charge.strength(-160);
    }
    const link = fg.d3Force("link") as unknown as Adjustable | undefined;
    if (link && typeof link.distance === "function") {
      link.distance(70);
    }
    if (graphData.nodes.length > 0) {
      requestAnimationFrame(() => fg.zoomToFit?.(600, 80));
    }
  }, [graphData.nodes.length]);

  const handleNodeClick = (node: GraphNode) => {
    if (node.notion_url) {
      window.open(node.notion_url, "_blank", "noopener,noreferrer");
      return;
    }
    // Center camera on the node when there's nothing to open.
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
    if (typeof node.x !== "number" || typeof node.y !== "number") return;
    const baseRadius = nodeBaseRadius(node);
    const focused = isFocused(node.id);
    const isHover = hoveredId === node.id;
    const radius = baseRadius * (isHover ? 1.25 : 1);
    const colors = nodeColor(node);
    const alpha = focused ? 1 : 0.18;

    // Glow when focused or hovered.
    if (focused) {
      const grad = ctx.createRadialGradient(node.x, node.y, radius * 0.6, node.x, node.y, radius * 3.4);
      grad.addColorStop(0, colors.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 3.4, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    if (isHover) {
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Label
    const label = node.label || "—";
    const fontSize = node.type === "user" ? 13 / globalScale : 10 / globalScale;
    ctx.font = `${node.type === "user" ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = focused ? "rgba(240, 240, 248, 0.95)" : "rgba(180, 180, 200, 0.35)";
    const truncated = label.length > 36 ? `${label.slice(0, 33)}…` : label;
    ctx.fillText(truncated, node.x, node.y + radius + 4 / globalScale);
  };

  const linkColor = (link: GraphLink): string => {
    const base = LINK_COLORS[link.kind] || "rgba(255,255,255,0.25)";
    if (!hoveredId) return base;
    return isLinkActive(link) ? base : "rgba(255,255,255,0.05)";
  };

  const linkWidth = (link: GraphLink): number => (isLinkActive(link) ? 1.6 : 0.6);

  const handleNodeHover = (node: GraphNode | null) => {
    setHoveredId(node ? node.id : null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? "pointer" : "default";
    }
  };

  const summary = canvasQuery.data?.summary;
  const targetUserLabel =
    canvasQuery.data?.user.display_name ||
    usersQuery.data?.users.find((u) => u.user_key === targetUserKey)?.display_name ||
    targetUserKey ||
    "—";

  return (
    <div className="min-h-full flex flex-col gap-4">
      <section className="glass overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-secondary">Network view</p>
        <h1 className="text-[28px] sm:text-[34px] leading-tight font-semibold mt-1">Canvas</h1>
        <p className="mt-2 max-w-2xl text-sm text-secondary">
          Vista de grafo estilo Obsidian: tu nodo central conectado a tus proyectos y de cada
          proyecto a sus productos. Pasa el mouse sobre un nodo para resaltar conexiones, hace
          click para abrir en Notion, y arrastrá para reordenar.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-[12px] text-secondary">
              <span>Ver canvas de</span>
              <select
                className="ui-select"
                value={targetUserKey || ""}
                onChange={(e) => setSelectedUserKey(e.target.value || null)}
              >
                {currentUser ? (
                  <option value={currentUser.user_key}>
                    {currentUser.display_name} (yo)
                  </option>
                ) : null}
                {(usersQuery.data?.users || [])
                  .filter((u) => u.user_key !== currentUser?.user_key)
                  .map((user) => (
                    <option key={user.user_key} value={user.user_key}>
                      {user.display_name}
                      {user.can_view_all ? " · admin" : ""}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {summary ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="ui-badge ui-badge--neutral">Usuario: {targetUserLabel}</span>
              <span className="ui-badge ui-badge--info">{summary.projects} proyectos</span>
              <span className="ui-badge ui-badge--success">{summary.products} productos</span>
              <span className="ui-badge ui-badge--accent">{summary.edges} conexiones</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass relative flex-1 min-h-[520px] overflow-hidden">
        <div className="canvas-legend">
          <span className="canvas-legend-item">
            <span className="canvas-legend-dot" style={{ background: NODE_COLORS.user.fill }} />
            Usuario
          </span>
          <span className="canvas-legend-item">
            <span className="canvas-legend-dot" style={{ background: NODE_COLORS.project.fill }} />
            Proyecto
          </span>
          <span className="canvas-legend-item">
            <span className="canvas-legend-dot" style={{ background: NODE_COLORS.product.fill }} />
            Producto
          </span>
        </div>

        <div
          ref={containerRef}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(40,42,54,0.65)_0%,rgba(15,16,22,0.95)_70%)]"
        >
          {canvasQuery.isLoading ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-secondary">
              Cargando grafo...
            </div>
          ) : canvasQuery.isError ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-red-400">
              No se pudo cargar el canvas.
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-secondary">
              No hay proyectos visibles para este usuario.
            </div>
          ) : (
            <ForceGraph2D<GraphNode, GraphLink>
              ref={graphRef}
              graphData={graphData}
              width={dimensions.w}
              height={dimensions.h}
              backgroundColor="rgba(0,0,0,0)"
              cooldownTicks={120}
              nodeRelSize={6}
              nodeCanvasObject={drawNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={(node, color, ctx) => {
                if (typeof node.x !== "number" || typeof node.y !== "number") return;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeBaseRadius(node) + 4, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkDirectionalParticles={(link) => (isLinkActive(link) ? 3 : 1)}
              linkDirectionalParticleSpeed={() => 0.006}
              linkDirectionalParticleWidth={(link) => (isLinkActive(link) ? 2.4 : 1.2)}
              linkDirectionalParticleColor={(link) =>
                LINK_COLORS[link.kind] || "rgba(255,255,255,0.5)"
              }
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
