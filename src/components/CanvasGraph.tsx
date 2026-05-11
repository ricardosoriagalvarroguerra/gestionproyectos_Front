import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasEdge, CanvasNode } from "../api/client";

export type GraphNodeMeta = CanvasNode & {
  shared_user_keys?: string[];
};

type Props = {
  nodes: GraphNodeMeta[];
  edges: CanvasEdge[];
  layout: "constellation" | "hierarchy";
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode?: (id: string | null) => void;
  /** Map of user_key → fill color (used in multi-user mode). Empty means single-user palette. */
  userColors?: Map<string, string>;
  /** Set of node ids that should be rendered with the "shared" halo. */
  haloNodeIds?: Set<string>;
};

type Pos = { x: number; y: number };

function nodeRadius(n: GraphNodeMeta): number {
  if (n.type === "user") return 14;
  if (n.type === "project") return 10;
  if (n.type === "product") return 5;
  return 3;
}

function colorFor(n: GraphNodeMeta, userColors?: Map<string, string>): string {
  if (n.type === "user") {
    if (userColors && n.user_key) {
      const c = userColors.get(n.user_key);
      if (c) return c;
    }
    return "var(--accent)";
  }
  if (n.type === "project") return "var(--text-primary)";
  if (n.type === "product") {
    const st = (n.estado || "").toLowerCase();
    if (["listo", "completado", "completo", "terminado", "hecho", "entregado"].includes(st)) return "var(--success)";
    if (["en curso", "en progreso", "activo", "ejecucion", "en ejecucion"].includes(st)) return "var(--info)";
    return "var(--text-muted)";
  }
  if (n.type === "task") {
    const st = (n.estado || "").toLowerCase();
    if (["listo", "completado", "completo", "terminado", "hecho", "entregado"].includes(st)) return "var(--success)";
    if (["en curso", "en progreso", "activo", "ejecucion", "en ejecucion"].includes(st)) return "var(--info)";
    return "var(--text-faint)";
  }
  return "var(--text-muted)";
}

/** Build a parent map: node id → array of connected user/project ids it should orbit. */
function buildParentMap(nodes: GraphNodeMeta[], edges: CanvasEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  edges.forEach((e) => {
    const fromNode = nodes.find((n) => n.id === e.source);
    const toNode = nodes.find((n) => n.id === e.target);
    if (!fromNode || !toNode) return;
    // For products: parent is the project they belong to.
    // For tasks: parent is the product (or project if no product link).
    if (e.kind === "project_product" || e.kind === "product_task" || e.kind === "user_project") {
      map.set(toNode.id, [...(map.get(toNode.id) || []), fromNode.id]);
    }
    if (e.kind === "user_product" || e.kind === "user_task") {
      map.set(toNode.id, [...(map.get(toNode.id) || []), fromNode.id]);
    }
  });
  return map;
}

function runSimulation(nodes: GraphNodeMeta[], edges: CanvasEdge[], layout: "constellation" | "hierarchy"): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const userIds = nodes.filter((n) => n.type === "user").map((n) => n.id);
  const projectIds = nodes.filter((n) => n.type === "project").map((n) => n.id);
  const parentMap = buildParentMap(nodes, edges);

  // Place users in a center cluster.
  if (userIds.length === 1) {
    pos.set(userIds[0], { x: 0, y: 0 });
  } else {
    userIds.forEach((id, i) => {
      const t = (i / userIds.length) * Math.PI * 2;
      pos.set(id, { x: Math.cos(t) * 60, y: Math.sin(t) * 60 });
    });
  }

  // Place projects on a ring around the user cluster.
  projectIds.forEach((id, i) => {
    const t = (i / Math.max(1, projectIds.length)) * Math.PI * 2;
    pos.set(id, { x: Math.cos(t) * 220, y: Math.sin(t) * 220 });
  });

  // Place products + tasks around their parent.
  nodes.forEach((n) => {
    if (n.type === "user" || n.type === "project") return;
    const parents = parentMap.get(n.id) || [];
    const parentPositions = parents.map((p) => pos.get(p)).filter(Boolean) as Pos[];
    let cx = 0;
    let cy = 0;
    if (parentPositions.length > 0) {
      cx = parentPositions.reduce((s, p) => s + p.x, 0) / parentPositions.length;
      cy = parentPositions.reduce((s, p) => s + p.y, 0) / parentPositions.length;
    }
    const seed = n.id.charCodeAt(n.id.length - 1) % 8;
    const t = (seed / 8) * Math.PI * 2;
    const r = n.type === "product" ? 85 : 45;
    pos.set(n.id, { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  });

  if (layout === "hierarchy") {
    const projs = nodes.filter((n) => n.type === "project");
    const colW = 180;
    const totalW = (projs.length - 1) * colW;
    projs.forEach((p, i) => {
      const x = -totalW / 2 + i * colW;
      pos.set(p.id, { x, y: 0 });
      const products = nodes.filter((n) => {
        if (n.type !== "product") return false;
        const parents = parentMap.get(n.id) || [];
        return parents.includes(p.id);
      });
      products.forEach((prod, j) => {
        pos.set(prod.id, { x, y: 100 + j * 38 });
        const tasks = nodes.filter((n) => {
          if (n.type !== "task") return false;
          const parents = parentMap.get(n.id) || [];
          return parents.includes(prod.id);
        });
        tasks.forEach((task, k) => {
          pos.set(task.id, { x: x + 60, y: 100 + j * 38 + k * 8 });
        });
      });
    });
    userIds.forEach((id, i) => {
      pos.set(id, { x: -totalW / 2 + i * 80, y: -140 });
    });
    return pos;
  }

  // Force-directed iterations
  const N = nodes.length;
  const K = 90;
  const iters = 220;
  const nodeArr = nodes;
  const edgeFromTo = edges
    .map((e) => ({ from: e.source, to: e.target, kind: e.kind }))
    .filter((e) => pos.has(e.from) && pos.has(e.to));

  for (let it = 0; it < iters; it++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodeArr.forEach((n) => forces.set(n.id, { x: 0, y: 0 }));

    // Repulsion (capped distance for performance).
    for (let i = 0; i < N; i++) {
      const a = nodeArr[i];
      const pa = pos.get(a.id);
      if (!pa) continue;
      for (let j = i + 1; j < N; j++) {
        const b = nodeArr[j];
        const pb = pos.get(b.id);
        if (!pb) continue;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const d2 = dx * dx + dy * dy + 1;
        if (d2 > 80_000) continue;
        const d = Math.sqrt(d2);
        const f = (K * K) / d2;
        const fa = forces.get(a.id)!;
        const fb = forces.get(b.id)!;
        fa.x += (dx / d) * f;
        fa.y += (dy / d) * f;
        fb.x -= (dx / d) * f;
        fb.y -= (dy / d) * f;
      }
    }

    // Attraction along edges
    edgeFromTo.forEach((e) => {
      const pa = pos.get(e.from)!;
      const pb = pos.get(e.to)!;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const idealLen =
        e.kind === "user_project"
          ? 200
          : e.kind === "project_product"
            ? 80
            : 40;
      const f = (d - idealLen) * 0.06;
      const fa = forces.get(e.from)!;
      const fb = forces.get(e.to)!;
      fa.x += (dx / d) * f;
      fa.y += (dy / d) * f;
      fb.x -= (dx / d) * f;
      fb.y -= (dy / d) * f;
    });

    // Pull users gently to center to keep the cluster anchored.
    userIds.forEach((id) => {
      const p = pos.get(id);
      const f = forces.get(id);
      if (!p || !f) return;
      f.x -= p.x * 0.3;
      f.y -= p.y * 0.3;
    });

    const damp = 0.85 - (it / iters) * 0.5;
    nodeArr.forEach((n) => {
      if (n.type === "user" && userIds.length === 1) return; // pin single user at origin
      const p = pos.get(n.id);
      const f = forces.get(n.id);
      if (!p || !f) return;
      p.x += f.x * damp * 0.05;
      p.y += f.y * damp * 0.05;
    });
  }

  return pos;
}

function clipLabel(label: string, max = 26): string {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + "…";
}

export function CanvasGraph({
  nodes,
  edges,
  layout,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
  userColors,
  haloNodeIds,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(400, rect.width), h: Math.max(400, rect.height) });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const positions = useMemo(() => runSimulation(nodes, edges, layout), [nodes, edges, layout]);

  // Compute viewBox bounds.
  const bounds = useMemo(() => {
    let minX = -400;
    let minY = -300;
    let maxX = 400;
    let maxY = 300;
    positions.forEach((p) => {
      if (p.x - 30 < minX) minX = p.x - 30;
      if (p.y - 20 < minY) minY = p.y - 20;
      if (p.x + 30 > maxX) maxX = p.x + 30;
      if (p.y + 20 > maxY) maxY = p.y + 20;
    });
    const pad = 60;
    return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [positions]);

  const active = selectedNodeId || hovered;
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    edges.forEach((e) => {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    });
    return map;
  }, [edges]);

  const highlight = useMemo(() => {
    if (!active) return null;
    const conn = new Set<string>([active]);
    const ns = adjacency.get(active);
    if (ns) ns.forEach((id) => conn.add(id));
    return conn;
  }, [active, adjacency]);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block" }}
        onClick={() => onSelectNode(null)}
      >
        <defs>
          <pattern id="cv-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-muted)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect x={bounds.minX} y={bounds.minY} width={bounds.w} height={bounds.h} fill="url(#cv-grid)" />

        {/* Edges */}
        {edges.map((e, i) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          const isHi = highlight ? highlight.has(e.source) && highlight.has(e.target) : true;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--text-muted)"
              strokeWidth={isHi ? 1 : 0.4}
              opacity={isHi ? 0.55 : 0.12}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const r = nodeRadius(n);
          const isUser = n.type === "user";
          const isProject = n.type === "project";
          const dim = highlight && !highlight.has(n.id);
          const fill = colorFor(n, userColors);
          const isHaloed = haloNodeIds?.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: "pointer", opacity: dim ? 0.22 : 1, transition: "opacity 0.15s" }}
              onMouseEnter={() => {
                setHovered(n.id);
                onHoverNode?.(n.id);
              }}
              onMouseLeave={() => {
                setHovered(null);
                onHoverNode?.(null);
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectNode(selectedNodeId === n.id ? null : n.id);
              }}
            >
              {isUser && <circle r={r + 9} fill={fill} opacity={0.18} />}
              {isHaloed && (
                <circle r={r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity={0.85} />
              )}
              <circle
                r={r}
                fill={fill}
                stroke={isUser ? "var(--accent)" : isProject ? "var(--text-primary)" : "none"}
                strokeWidth={isUser ? 2 : 0}
              />
              {(isUser || isProject) && (
                <text
                  x={0}
                  y={r + 14}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={isUser ? 13 : 11.5}
                  fontWeight={isUser ? 600 : 500}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {clipLabel(n.label || "")}
                </text>
              )}
              {n.type === "product" && (
                <text
                  x={0}
                  y={r + 11}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize={9.5}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {clipLabel(n.label || "", 22)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
