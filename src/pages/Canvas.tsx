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
import { formatDateLabel } from "../utils/display";

type GraphNode = CanvasNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  shared_user_keys?: string[];
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
  // Cool-spectrum ramp: project (indigo) → product (blue) → task (cyan).
  // Same color family, differentiated by hue + tone for a coherent feel.
  project: { fill: string; glow: string };
  product: { fill: string; glow: string };
  task: { fill: string; glow: string };
  link: string;
  particle: string;
  labelActive: string;
  labelDim: string;
  hoverStroke: string;
  linkDim: string;
  haloStroke: string;
  badgeBg: string;
  badgeText: string;
};

const USER_RED = "#c1121f";
const USER_RED_GLOW = "rgba(193, 18, 31, 0.55)";

// Multi-user palette for the DARK theme (saturated, vivid on black bg).
const USER_PALETTE_DARK: { fill: string; glow: string }[] = [
  { fill: "#c1121f", glow: "rgba(193, 18, 31, 0.55)" },
  { fill: "#2563eb", glow: "rgba(37, 99, 235, 0.5)" },
  { fill: "#16a34a", glow: "rgba(22, 163, 74, 0.5)" },
  { fill: "#d97706", glow: "rgba(217, 119, 6, 0.5)" },
  { fill: "#9333ea", glow: "rgba(147, 51, 234, 0.5)" },
  { fill: "#0891b2", glow: "rgba(8, 145, 178, 0.5)" },
  { fill: "#be185d", glow: "rgba(190, 24, 93, 0.5)" },
  { fill: "#65a30d", glow: "rgba(101, 163, 13, 0.5)" },
  { fill: "#7c3aed", glow: "rgba(124, 58, 237, 0.5)" },
  { fill: "#db2777", glow: "rgba(219, 39, 119, 0.5)" },
];

// Multi-user palette for the LIGHT theme — softer / less saturated tones
// so they don't shout against the white background.
const USER_PALETTE_LIGHT: { fill: string; glow: string }[] = [
  { fill: "#a4133c", glow: "rgba(164, 19, 60, 0.22)" },
  { fill: "#3b6db8", glow: "rgba(59, 109, 184, 0.22)" },
  { fill: "#3a7a52", glow: "rgba(58, 122, 82, 0.22)" },
  { fill: "#a3741c", glow: "rgba(163, 116, 28, 0.22)" },
  { fill: "#6e4ea5", glow: "rgba(110, 78, 165, 0.22)" },
  { fill: "#3a7a8c", glow: "rgba(58, 122, 140, 0.22)" },
  { fill: "#9c4170", glow: "rgba(156, 65, 112, 0.22)" },
  { fill: "#5b7a3b", glow: "rgba(91, 122, 59, 0.22)" },
  { fill: "#7355a0", glow: "rgba(115, 85, 160, 0.22)" },
  { fill: "#a85689", glow: "rgba(168, 86, 137, 0.22)" },
];

// Notion-inspired palette: warm paper for light, ink for dark, single red accent.
// Node hierarchy uses the design's blue (info) / green (success) / muted ramp.
const DARK_PALETTE: Palette = {
  background: "#191918",
  user: { fill: "#e94f4f", glow: "rgba(233, 79, 79, 0.45)" },
  project: { fill: "#ededeb", glow: "rgba(237, 237, 235, 0.30)" },
  product: { fill: "#7aa7ff", glow: "rgba(122, 167, 255, 0.30)" },
  task: { fill: "#87857f", glow: "rgba(135, 133, 127, 0.30)" },
  link: "rgba(255, 255, 255, 0.18)",
  linkDim: "rgba(255, 255, 255, 0.05)",
  particle: "rgba(255, 255, 255, 0.55)",
  labelActive: "rgba(237, 237, 235, 0.95)",
  labelDim: "rgba(184, 182, 176, 0.4)",
  hoverStroke: "rgba(255, 255, 255, 0.75)",
  haloStroke: "rgba(233, 79, 79, 0.85)",
  badgeBg: "#e94f4f",
  badgeText: "#ffffff",
};

const LIGHT_PALETTE: Palette = {
  background: "#fbfaf7",
  user: { fill: "#b8312b", glow: "rgba(184, 49, 43, 0.20)" },
  project: { fill: "#2b2b29", glow: "rgba(43, 43, 41, 0.20)" },
  product: { fill: "#3b6db8", glow: "rgba(59, 109, 184, 0.18)" },
  task: { fill: "#8a8884", glow: "rgba(138, 136, 132, 0.18)" },
  link: "rgba(43, 43, 41, 0.20)",
  linkDim: "rgba(43, 43, 41, 0.06)",
  particle: "rgba(43, 43, 41, 0.50)",
  labelActive: "rgba(43, 43, 41, 0.95)",
  labelDim: "rgba(138, 136, 132, 0.45)",
  hoverStroke: "rgba(43, 43, 41, 0.6)",
  haloStroke: "rgba(184, 49, 43, 0.7)",
  badgeBg: "#b8312b",
  badgeText: "#ffffff",
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
  // Strong visual hierarchy with overall larger sizes.
  // Ratios kept the same: 12 : 6 : 3 : 1 (user : project : product : task).
  if (node.type === "user") return 60;
  if (node.type === "project") return 30;
  if (node.type === "product") return 15;
  return 5; // task
}

const GRANULARITY_OPTIONS: { value: CanvasGranularity; label: string; help: string }[] = [
  { value: "projects", label: "Solo proyectos", help: "Usuario y proyectos" },
  { value: "products", label: "Proyectos y productos", help: "Hasta nivel de productos" },
  { value: "tasks", label: "Proyectos, productos y tareas", help: "Vista completa" },
];

type LayoutMode = "constellation" | "hierarchy";
type OverlapFilter = "all" | "shared" | "exclusive";

const OVERLAP_OPTIONS: { value: OverlapFilter; label: string; help: string }[] = [
  { value: "all", label: "Todo", help: "Mostrar todos los nodos visibles" },
  { value: "shared", label: "Solo compartidos", help: "Items conectados a 2+ usuarios" },
  { value: "exclusive", label: "Solo exclusivos", help: "Items conectados a un solo usuario" },
];

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: "constellation", label: "Constelación" },
  { value: "hierarchy", label: "Jerarquía" },
];

export function Canvas({ currentUser }: { currentUser: AuthUser | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [granularity, setGranularity] = useState<CanvasGranularity>("products");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overlapFilter, setOverlapFilter] = useState<OverlapFilter>("all");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("constellation");

  const resolvedTheme = useResolvedTheme();
  const palette = resolvedTheme === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  const isAdmin = !!currentUser?.can_view_all;

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setDimensions({ w: Math.max(320, rect.width), h: Math.max(360, rect.height) });
    }, 320);
    return () => window.clearTimeout(t);
  }, [sidebarOpen]);

  // Color mapping: each selected user gets a stable palette slot in multi mode.
  // Light theme uses a softer (less saturated) palette than dark.
  const userColorByKey = useMemo<Map<string, { fill: string; glow: string }>>(() => {
    const map = new Map<string, { fill: string; glow: string }>();
    const palette = resolvedTheme === "light" ? USER_PALETTE_LIGHT : USER_PALETTE_DARK;
    effectiveUserKeys.forEach((key, index) => {
      map.set(key, palette[index % palette.length]);
    });
    return map;
  }, [effectiveUserKeys, resolvedTheme]);

  // Raw graph (server data) — without overlap filter applied.
  const baseGraphData = useMemo<GraphData>(() => {
    const data = canvasQuery.data;
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.edges.map((edge) => ({ ...edge })),
    };
  }, [canvasQuery.data]);

  // Adjacency on the raw data (used for shared count and click panel).
  const baseAdjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    baseGraphData.links.forEach((link) => {
      const s = nodeId(link.source);
      const t = nodeId(link.target);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    });
    return map;
  }, [baseGraphData]);

  // Set of user node ids in the graph.
  const userNodeIds = useMemo(() => {
    return new Set(baseGraphData.nodes.filter((n) => n.type === "user").map((n) => n.id));
  }, [baseGraphData]);

  // For each non-user node, count how many user nodes it's connected to.
  const sharedCountById = useMemo(() => {
    const counts = new Map<string, number>();
    baseGraphData.nodes.forEach((node) => {
      if (node.type === "user") return;
      const neighbors = baseAdjacency.get(node.id);
      if (!neighbors) {
        counts.set(node.id, 0);
        return;
      }
      let cnt = 0;
      neighbors.forEach((id) => {
        if (userNodeIds.has(id)) cnt += 1;
      });
      counts.set(node.id, cnt);
    });
    return counts;
  }, [baseGraphData, baseAdjacency, userNodeIds]);

  // Apply the overlap filter to the graph data.
  const graphData = useMemo<GraphData>(() => {
    if (overlapFilter === "all" || !isMulti) return baseGraphData;

    const visibleIds = new Set<string>();
    baseGraphData.nodes.forEach((node) => {
      if (node.type === "user") {
        visibleIds.add(node.id); // always keep users for context
        return;
      }
      const cnt = sharedCountById.get(node.id) ?? 0;
      if (overlapFilter === "shared" && cnt >= 2) visibleIds.add(node.id);
      if (overlapFilter === "exclusive" && cnt <= 1) visibleIds.add(node.id);
    });

    return {
      nodes: baseGraphData.nodes.filter((n) => visibleIds.has(n.id)),
      links: baseGraphData.links.filter(
        (l) => visibleIds.has(nodeId(l.source)) && visibleIds.has(nodeId(l.target))
      ),
    };
  }, [baseGraphData, sharedCountById, overlapFilter, isMulti]);

  // Adjacency for the visible (filtered) graph — used for hover focus.
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

  // Pin nodes in concentric rings for hierarchy mode, release for constellation.
  const applyHierarchyLayout = () => {
    const nodes = graphData.nodes;
    if (nodes.length === 0) return;

    const place = (arr: GraphNode[], radius: number, offset = 0) => {
      const len = Math.max(1, arr.length);
      arr.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / len - Math.PI / 2 + offset;
        const fx = Math.cos(angle) * radius;
        const fy = Math.sin(angle) * radius;
        n.fx = fx;
        n.fy = fy;
        n.x = fx;
        n.y = fy;
        n.vx = 0;
        n.vy = 0;
      });
    };

    const users = nodes.filter((n) => n.type === "user");
    const tasks = nodes.filter((n) => n.type === "task");
    const products = nodes.filter((n) => n.type === "product");
    const projects = nodes.filter((n) => n.type === "project");

    // Tasks at the inner ring, products mid, projects outer; users in the very center.
    const userRadius = users.length > 1 ? 50 : 0;
    place(users, userRadius);
    if (tasks.length > 0) place(tasks, 170, 0.1);
    if (products.length > 0) place(products, 320, 0.05);
    if (projects.length > 0) place(projects, 480);
  };

  const releaseHierarchyLayout = () => {
    graphData.nodes.forEach((n) => {
      delete n.fx;
      delete n.fy;
    });
  };

  // Tune force layout based on mode + density.
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    type Adjustable = {
      strength?: (s: number) => unknown;
      distance?: (d: number) => unknown;
    };
    const charge = fg.d3Force("charge") as unknown as Adjustable | undefined;
    const link = fg.d3Force("link") as unknown as Adjustable | undefined;

    if (layoutMode === "hierarchy") {
      // Soft forces, mostly the rings hold positions because nodes are pinned.
      if (charge && typeof charge.strength === "function") charge.strength(-30);
      if (link && typeof link.distance === "function") link.distance(60);
      applyHierarchyLayout();
    } else {
      releaseHierarchyLayout();
      if (charge && typeof charge.strength === "function") {
        const n = Math.max(1, graphData.nodes.length);
        // Bigger nodes need proportionally more breathing room.
        const base = granularity === "tasks" ? -1900 : granularity === "products" ? -3000 : -4000;
        const scaled = base * Math.min(2.5, Math.max(0.9, 40 / Math.sqrt(n)));
        charge.strength(scaled);
      }
      const chargeAny = charge as unknown as { theta?: (t: number) => unknown; distanceMax?: (d: number) => unknown };
      if (chargeAny && typeof chargeAny.distanceMax === "function") {
        chargeAny.distanceMax(3200);
      }
      if (link && typeof link.distance === "function") {
        const distance = granularity === "tasks" ? 480 : granularity === "products" ? 720 : 920;
        link.distance(distance);
      }
      const linkAny = link as unknown as { strength?: (s: number) => unknown };
      if (linkAny && typeof linkAny.strength === "function") {
        // Even softer pull so the long distances aren't snapped back.
        linkAny.strength(0.18);
      }
    }

    if (graphData.nodes.length > 0) {
      fg.d3ReheatSimulation?.();
      const t = window.setTimeout(() => fg.zoomToFit?.(700, 140), 250);
      return () => window.clearTimeout(t);
    }
  }, [graphData.nodes.length, granularity, layoutMode, overlapFilter]);

  const handleNodeClick = (node: GraphNode) => {
    // Open detail panel inline; the panel has its own "Abrir en Notion" button.
    setSelectedNodeId(node.id);
    const fg = graphRef.current;
    if (fg && Number.isFinite(node.x) && Number.isFinite(node.y)) {
      fg.centerAt(node.x as number, node.y as number, 600);
    }
  };

  const drawNode = (
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const x = node.x as number;
    const y = node.y as number;
    const baseRadius = nodeBaseRadius(node);
    const focused = isFocused(node.id);
    const isHover = hoveredId === node.id;
    const isSelected = selectedNodeId === node.id;
    const radius = baseRadius * (isHover || isSelected ? 1.25 : 1);

    // Pick color — user nodes follow the user palette; project/product/task
    // each have their own colour from the cool-spectrum ramp.
    let colors: { fill: string; glow: string };
    if (node.type === "user") {
      if (isMulti && node.user_key) {
        colors = userColorByKey.get(node.user_key) || palette.user;
      } else {
        colors = palette.user;
      }
    } else if (node.type === "project") {
      colors = palette.project;
    } else if (node.type === "product") {
      colors = palette.product;
    } else {
      colors = palette.task;
    }

    const sharedCount = sharedCountById.get(node.id) ?? 0;
    const isShared = node.type !== "user" && sharedCount >= 2;
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

    // Halo ring for shared items.
    if (isShared) {
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = palette.haloStroke;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3 / globalScale, 0, 2 * Math.PI, false);
      ctx.stroke();
    }

    if (isHover || isSelected) {
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = palette.hoverStroke;
      ctx.beginPath();
      ctx.arc(x, y, radius + 1 / globalScale, 0, 2 * Math.PI, false);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Badge with shared count for shared items.
    if (isShared) {
      const badgeRadius = 7 / globalScale;
      const bx = x + radius * 0.95;
      const by = y - radius * 0.95;
      ctx.beginPath();
      ctx.arc(bx, by, badgeRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = palette.badgeBg;
      ctx.fill();
      ctx.fillStyle = palette.badgeText;
      ctx.font = `700 ${Math.max(8, 9 / globalScale)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(sharedCount), bx, by + 0.5 / globalScale);
    }

    // Label — size mirrors the node hierarchy.
    const label = node.label || "—";
    const fontSize =
      node.type === "user"
        ? 22 / globalScale
        : node.type === "project"
          ? 14 / globalScale
          : node.type === "product"
            ? 10.5 / globalScale
            : 8 / globalScale; // task
    ctx.font = `${node.type === "user" ? "700" : node.type === "project" ? "600" : "500"} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = focused ? palette.labelActive : palette.labelDim;
    const truncated = label.length > 36 ? `${label.slice(0, 33)}…` : label;
    ctx.fillText(truncated, x, y + radius + 4 / globalScale);
  };

  const linkColor = (link: GraphLink): string => {
    // In multi mode, user-origin links carry the user's palette color.
    if (isMulti && (link.kind === "user_project" || link.kind === "user_product" || link.kind === "user_task")) {
      const sourceId = nodeId(link.source);
      // user_project edges have source=user, target=project. Find user_key from id.
      const sourceNode = baseGraphData.nodes.find((n) => n.id === sourceId);
      const userKey = sourceNode?.user_key;
      if (userKey) {
        const c = userColorByKey.get(userKey);
        if (c) {
          if (!hoveredId) return withAlpha(c.fill, 0.55);
          return isLinkActive(link) ? withAlpha(c.fill, 0.7) : withAlpha(c.fill, 0.06);
        }
      }
    }
    if (!hoveredId) return palette.link;
    return isLinkActive(link) ? palette.link : palette.linkDim;
  };

  const linkWidth = (link: GraphLink): number => (isLinkActive(link) ? 1.6 : 0.6);

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
      if (next.has(userKey)) next.delete(userKey);
      else next.add(userKey);
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedUserKeys([]);

  const resetView = () => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.zoomToFit?.(700, 140);
  };

  const reorganize = () => {
    const fg = graphRef.current;
    if (!fg) return;
    const nodes = graphData.nodes;
    if (nodes.length === 0) return;

    const userNodes = nodes.filter((n) => n.type === "user");
    const otherNodes = nodes.filter((n) => n.type !== "user");
    const userCount = Math.max(1, userNodes.length);
    const ringRadius = Math.max(200, 90 * userCount);

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

  const selectedNode = useMemo(
    () => baseGraphData.nodes.find((n) => n.id === selectedNodeId) || null,
    [baseGraphData, selectedNodeId]
  );

  const selectedNodeUsers = useMemo<{ user_key: string; display_name: string; color: string }[]>(() => {
    if (!selectedNode || selectedNode.type === "user") return [];
    const neighbors = baseAdjacency.get(selectedNode.id);
    if (!neighbors) return [];
    const result: { user_key: string; display_name: string; color: string }[] = [];
    baseGraphData.nodes.forEach((n) => {
      if (n.type !== "user" || !neighbors.has(n.id) || !n.user_key) return;
      const color = (isMulti ? userColorByKey.get(n.user_key)?.fill : palette.user.fill) || palette.user.fill;
      result.push({
        user_key: n.user_key,
        display_name: n.label,
        color,
      });
    });
    return result;
  }, [selectedNode, baseGraphData, baseAdjacency, isMulti, userColorByKey, palette]);

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
            Hover para resaltar conexiones, click para abrir un panel con detalles, drag para reordenar.
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
                  <UserRow
                    label={`${currentUser.display_name} (yo)`}
                    checked={effectiveUserKeys.includes(currentUser.user_key)}
                    color={
                      isMulti
                        ? userColorByKey.get(currentUser.user_key)?.fill
                        : palette.user.fill
                    }
                    onChange={() => toggleUserSelection(currentUser.user_key)}
                  />
                ) : null}
                {allUserOptions
                  .filter((u) => u.user_key !== currentUser?.user_key)
                  .map((user) => {
                    const checked = effectiveUserKeys.includes(user.user_key);
                    return (
                      <UserRow
                        key={user.user_key}
                        label={`${user.display_name}${user.can_view_all ? " · admin" : ""}`}
                        checked={checked}
                        color={isMulti ? userColorByKey.get(user.user_key)?.fill : undefined}
                        onChange={() => toggleUserSelection(user.user_key)}
                      />
                    );
                  })}
              </div>
              <p className="text-[10px] text-secondary">
                Tildá varios para ver cómo se interconectan entre sí.
              </p>
            </div>
          ) : null}

          {isMulti ? (
            <div className="canvas-sidebar-section">
              <div className="canvas-sidebar-heading">Filtro de superposición</div>
              <div className="canvas-granularity">
                {OVERLAP_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`canvas-granularity-option ${overlapFilter === opt.value ? "is-active" : ""}`}
                    title={opt.help}
                  >
                    <input
                      type="radio"
                      name="canvas-overlap"
                      value={opt.value}
                      checked={overlapFilter === opt.value}
                      onChange={() => setOverlapFilter(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="canvas-sidebar-section">
            <div className="canvas-sidebar-heading">Disposición</div>
            <div className="canvas-segmented">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`canvas-segment ${layoutMode === opt.value ? "is-active" : ""}`}
                  onClick={() => setLayoutMode(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-secondary">
              {layoutMode === "constellation"
                ? "Force-directed orgánico (default)."
                : "Anillos concéntricos: tareas centro · productos medio · proyectos exterior."}
            </p>
          </div>

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
                <span className="canvas-legend-dot" style={{ background: palette.user.fill, width: 14, height: 14 }} />
                Usuario
              </span>
              <span className="canvas-legend-item">
                <span className="canvas-legend-dot" style={{ background: palette.project.fill, width: 11, height: 11 }} />
                Proyecto
              </span>
              <span className="canvas-legend-item">
                <span className="canvas-legend-dot" style={{ background: palette.product.fill, width: 8, height: 8 }} />
                Producto
              </span>
              <span className="canvas-legend-item">
                <span className="canvas-legend-dot" style={{ background: palette.task.fill, width: 5, height: 5 }} />
                Tarea
              </span>
              {isMulti ? (
                <span className="canvas-legend-item">
                  <span
                    className="canvas-legend-dot"
                    style={{
                      background: "transparent",
                      border: `2px solid ${palette.haloStroke}`,
                    }}
                  />
                  Compartido (2+)
                </span>
              ) : null}
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
              cooldownTicks={250}
              cooldownTime={10000}
              d3AlphaDecay={0.022}
              d3VelocityDecay={0.42}
              warmupTicks={40}
              nodeRelSize={6}
              minZoom={0.08}
              maxZoom={6}
              nodeCanvasObject={drawNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={(node, color, ctx) => {
                if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x as number, node.y as number, nodeBaseRadius(node) + 4, 0, 2 * Math.PI, false);
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
              onBackgroundClick={() => {
                setHoveredId(null);
                setSelectedNodeId(null);
              }}
              enableZoomInteraction
              enablePanInteraction
              enableNodeDrag
            />
          )}
        </div>

        {selectedNode ? (
          <NodeDetailPanel
            node={selectedNode}
            connectedUsers={selectedNodeUsers}
            sharedCount={sharedCountById.get(selectedNode.id) ?? 0}
            onClose={() => setSelectedNodeId(null)}
            theme={resolvedTheme}
          />
        ) : null}
      </section>
    </div>
  );
}

function UserRow({
  label,
  checked,
  color,
  onChange,
}: {
  label: string;
  checked: boolean;
  color?: string;
  onChange: () => void;
}) {
  return (
    <label className={`canvas-user-row ${checked ? "is-active" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {color ? (
        <span className="canvas-legend-dot" style={{ background: color, flex: "0 0 auto" }} />
      ) : null}
      <span className="truncate">{label}</span>
    </label>
  );
}

function NodeDetailPanel({
  node,
  connectedUsers,
  sharedCount,
  onClose,
  theme,
}: {
  node: GraphNode;
  connectedUsers: { user_key: string; display_name: string; color: string }[];
  sharedCount: number;
  onClose: () => void;
  theme: ResolvedTheme;
}) {
  const typeLabel =
    node.type === "user" ? "Usuario"
      : node.type === "project" ? "Proyecto"
        : node.type === "product" ? "Producto"
          : "Tarea";

  const fechaStart = node.fecha_start || node.fecha_entrega_start || null;
  const fechaEnd = node.fecha_end || node.fecha_entrega_end || null;

  return (
    <div className={`canvas-detail ${theme === "light" ? "is-light" : ""}`}>
      <div className="canvas-detail-header">
        <div className="min-w-0">
          <div className="canvas-detail-eyebrow">{typeLabel}</div>
          <h3 className="canvas-detail-title">{node.label || "—"}</h3>
        </div>
        <button type="button" className="canvas-detail-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      {node.type !== "user" ? (
        <div className="canvas-detail-meta">
          {node.estado ? (
            <span className="canvas-detail-pill">{node.estado}</span>
          ) : null}
          {sharedCount >= 2 ? (
            <span className="canvas-detail-pill is-shared">Compartido por {sharedCount}</span>
          ) : null}
        </div>
      ) : null}

      {(fechaStart || fechaEnd) ? (
        <div className="canvas-detail-row">
          <span className="canvas-detail-row-label">Fechas</span>
          <span>
            {formatDateLabel(fechaStart, "—")} – {formatDateLabel(fechaEnd, "—")}
          </span>
        </div>
      ) : null}

      {connectedUsers.length > 0 ? (
        <div className="canvas-detail-section">
          <div className="canvas-detail-row-label">
            {connectedUsers.length === 1 ? "Visible para" : "Compartido entre"}
          </div>
          <div className="canvas-detail-users">
            {connectedUsers.map((u) => (
              <span key={u.user_key} className="canvas-detail-user">
                <span className="canvas-legend-dot" style={{ background: u.color }} />
                {u.display_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {node.notion_url ? (
        <a
          href={node.notion_url}
          target="_blank"
          rel="noreferrer"
          className="canvas-mini-button canvas-detail-cta"
        >
          Abrir en Notion ↗
        </a>
      ) : null}
    </div>
  );
}

// helpers ---------------------------------------------------------------------

function withAlpha(hex: string, alpha: number): string {
  // Accept #rrggbb or rgba(...) — for simplicity convert hex into rgba.
  if (hex.startsWith("#") && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}
