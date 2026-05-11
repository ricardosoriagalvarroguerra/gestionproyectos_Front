/* global React, Icon */
const { useState: useState_cv, useMemo: useMemo_cv, useRef: useRef_cv, useEffect: useEffect_cv } = React;

// Force-directed graph laid out with a deterministic simulation.
function CanvasView() {
  const { projects, products, users } = window.APP_DATA;
  const [layout, setLayout] = useState_cv('constelacion'); // constelacion | jerarquia
  const [granularity, setGranularity] = useState_cv('productos'); // proyectos | productos | tareas
  const [hovered, setHovered] = useState_cv(null);
  const [pinned, setPinned] = useState_cv(null);
  const [visibleUsers, setVisibleUsers] = useState_cv({ rsg: true });

  // Build graph nodes/edges according to granularity
  const { nodes, edges } = useMemo_cv(() => {
    const ns = [];
    const es = [];
    const meId = 'rsg';
    ns.push({ id: meId, label: 'Ricardo Soria Galvarro', type: 'me', r: 14 });

    projects.forEach(p => {
      ns.push({ id: p.id, label: p.name, type: 'project', r: 10, lead: p.lead, team: p.team, overdue: p.overdue, progress: p.progress });
      es.push({ from: meId, to: p.id, kind: 'me-proj' });
    });

    if (granularity !== 'proyectos') {
      Object.entries(products).forEach(([projId, prods]) => {
        prods.forEach(prod => {
          const nid = `${projId}-${prod.id}`;
          ns.push({ id: nid, label: prod.name, type: 'product', r: 5, parent: projId, status: prod.status });
          es.push({ from: projId, to: nid, kind: 'proj-prod' });
        });
      });
    }

    if (granularity === 'tareas') {
      // Add some tasks for visualization (simplified)
      window.APP_DATA.tasks.forEach((t, i) => {
        const nid = `t-${t.id}`;
        ns.push({ id: nid, label: t.name.slice(0, 24), type: 'task', r: 3, parent: t.project, status: t.status });
        es.push({ from: t.project, to: nid, kind: 'prod-task' });
      });
    }
    return { nodes: ns, edges: es };
  }, [granularity]);

  // Run a small force simulation
  const positioned = useMemo_cv(() => {
    const N = nodes.length;
    const pos = new Map();
    // Initial: radial by depth
    const projectIdx = new Map();
    nodes.filter(n => n.type === 'project').forEach((n, i, arr) => projectIdx.set(n.id, i / arr.length));

    nodes.forEach(n => {
      if (n.type === 'me') pos.set(n.id, { x: 0, y: 0 });
      else if (n.type === 'project') {
        const t = projectIdx.get(n.id) * Math.PI * 2;
        pos.set(n.id, { x: Math.cos(t) * 220, y: Math.sin(t) * 220 });
      } else {
        const parent = pos.get(n.parent) || { x: 0, y: 0 };
        const t = (n.id.charCodeAt(n.id.length - 1) % 8) * (Math.PI / 4);
        pos.set(n.id, { x: parent.x + Math.cos(t) * 85, y: parent.y + Math.sin(t) * 85 });
      }
    });

    if (layout === 'jerarquia') {
      // Tree-like: project nodes in columns, products in tree
      const projs = nodes.filter(n => n.type === 'project');
      const colW = 160;
      const totalW = (projs.length - 1) * colW;
      projs.forEach((p, i) => {
        pos.set(p.id, { x: -totalW/2 + i * colW, y: 0 });
        const kids = nodes.filter(n => n.parent === p.id && n.type === 'product');
        kids.forEach((k, j) => {
          pos.set(k.id, { x: -totalW/2 + i * colW, y: 90 + j * 36 });
          const subkids = nodes.filter(n => n.parent === k.id);
          subkids.forEach((s, m) => pos.set(s.id, { x: -totalW/2 + i * colW + 50 + m*4, y: 90 + j * 36 + 16 }));
        });
      });
      pos.set('rsg', { x: 0, y: -120 });
      return pos;
    }

    // Force-directed iterations
    const K = 90;
    const iters = 220;
    for (let it = 0; it < iters; it++) {
      const forces = new Map();
      nodes.forEach(n => forces.set(n.id, { x: 0, y: 0 }));
      // repulsion
      for (let i = 0; i < N; i++) {
        for (let j = i+1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          const pa = pos.get(a.id), pb = pos.get(b.id);
          let dx = pa.x - pb.x, dy = pa.y - pb.y;
          let d2 = dx*dx + dy*dy + 1;
          let f = (K*K) / d2;
          if (d2 > 60000) continue;
          const d = Math.sqrt(d2);
          forces.get(a.id).x += (dx/d) * f;
          forces.get(a.id).y += (dy/d) * f;
          forces.get(b.id).x -= (dx/d) * f;
          forces.get(b.id).y -= (dy/d) * f;
        }
      }
      // attraction along edges
      edges.forEach(e => {
        const pa = pos.get(e.from), pb = pos.get(e.to);
        if (!pa || !pb) return;
        let dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d = Math.sqrt(dx*dx + dy*dy) + 0.01;
        const idealLen = e.kind === 'me-proj' ? 200 : e.kind === 'proj-prod' ? 80 : 40;
        const f = (d - idealLen) * 0.06;
        forces.get(e.from).x += (dx/d) * f;
        forces.get(e.from).y += (dy/d) * f;
        forces.get(e.to).x -= (dx/d) * f;
        forces.get(e.to).y -= (dy/d) * f;
      });
      // pull "me" to center
      forces.get('rsg').x -= pos.get('rsg').x * 0.3;
      forces.get('rsg').y -= pos.get('rsg').y * 0.3;
      // apply
      const damp = 0.85 - it/iters * 0.5;
      nodes.forEach(n => {
        if (n.id === 'rsg') return;
        const p = pos.get(n.id);
        const f = forces.get(n.id);
        p.x += f.x * damp * 0.05;
        p.y += f.y * damp * 0.05;
      });
    }
    return pos;
  }, [layout, granularity, nodes, edges]);

  // Compute viewBox
  let minX = -400, minY = -300, maxX = 400, maxY = 300;
  positioned.forEach(p => {
    minX = Math.min(minX, p.x - 30); minY = Math.min(minY, p.y - 20);
    maxX = Math.max(maxX, p.x + 30); maxY = Math.max(maxY, p.y + 20);
  });
  const pad = 40;
  const vbW = maxX - minX + pad*2, vbH = maxY - minY + pad*2;

  // Connection set for highlight
  const active = pinned || hovered;
  const highlight = useMemo_cv(() => {
    if (!active) return null;
    const conn = new Set([active]);
    edges.forEach(e => {
      if (e.from === active) conn.add(e.to);
      if (e.to === active) conn.add(e.from);
    });
    return conn;
  }, [active, edges]);

  const colorFor = (n) => {
    if (n.type === 'me') return 'var(--accent)';
    if (n.type === 'project') return 'var(--text)';
    if (n.type === 'product') {
      if (n.status === 'listo') return 'var(--success)';
      if (n.status === 'en-curso') return 'var(--info)';
      return 'var(--text-3)';
    }
    if (n.type === 'task') {
      if (n.status === 'listo') return 'var(--success)';
      if (n.status === 'en-curso') return 'var(--info)';
      return 'var(--text-4)';
    }
    return 'var(--text-3)';
  };

  const activeNode = active ? nodes.find(n => n.id === active) : null;

  return (
    <div className="content" style={{ maxWidth: 'none', padding: '0', display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 'calc(100vh - 49px)' }}>
      {/* Left panel — controls */}
      <div style={{ borderRight: '1px solid var(--border)', padding: '32px 24px', background: 'var(--bg)' }}>
        <div className="page-eyebrow">Network view</div>
        <h2 className="page-title" style={{ fontSize: 24, margin: '4px 0 12px' }}>Canvas</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 24px' }}>
          Grafo de relaciones entre tu nodo, proyectos, productos y tareas. <span className="muted">Hover</span> para resaltar conexiones, <span className="muted">click</span> para fijar y abrir detalles.
        </p>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Granularidad</div>
        <div className="v-stack" style={{ gap: 4, marginBottom: 20 }}>
          {[['proyectos','Solo proyectos'],['productos','Proyectos y productos'],['tareas','Proyectos, productos y tareas']].map(([k,l]) => (
            <label key={k} className="row" style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: granularity===k ? 'var(--accent-soft)' : 'transparent', color: granularity===k ? 'var(--accent-text)' : 'var(--text-2)', fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, border: `1.5px solid ${granularity===k ? 'var(--accent)' : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center' }}>
                {granularity===k && <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }}/>}
              </span>
              {l}
            </label>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Disposición</div>
        <div className="row" style={{ background: 'var(--surface-2)', padding: 2, borderRadius: 7, marginBottom: 20 }}>
          {[['constelacion','Constelación'],['jerarquia','Jerarquía']].map(([k,l]) => (
            <button key={k} className="tb-tab" style={{ flex: 1, ...(layout===k ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}) }} onClick={() => setLayout(k)}>{l}</button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Leyenda</div>
        <div className="v-stack" style={{ gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
          <div className="row"><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent)' }}/> Tú</div>
          <div className="row"><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--text)' }}/> Proyecto</div>
          <div className="row"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--info)' }}/> Producto en curso</div>
          <div className="row"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--success)' }}/> Producto listo</div>
          <div className="row"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--text-3)' }}/> Sin empezar</div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '24px 0 6px' }}>Usuarios visibles</div>
        <div className="v-stack" style={{ gap: 2 }}>
          {users.slice(0, 8).map(u => (
            <label key={u.id} className="row" style={{ padding: '4px 6px', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={!!visibleUsers[u.id]} onChange={e => setVisibleUsers(v => ({ ...v, [u.id]: e.target.checked }))} style={{ accentColor: 'var(--accent)' }}/>
              <Avatar user={u} size={16}/>
              <span className="truncate">{u.name}{u.me ? ' (yo)' : ''}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Right — graph */}
      <div style={{ position: 'relative', background: 'var(--bg)', overflow: 'hidden' }}>
        <svg viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`} style={{ width: '100%', height: '100%', display: 'block' }} onClick={() => setPinned(null)}>
          {/* grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x={minX - pad} y={minY - pad} width={vbW} height={vbH} fill="url(#grid)"/>

          {/* edges */}
          {edges.map((e, i) => {
            const a = positioned.get(e.from), b = positioned.get(e.to);
            if (!a || !b) return null;
            const isHi = highlight ? (highlight.has(e.from) && highlight.has(e.to)) : true;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--text-3)"
                strokeWidth={isHi ? 1 : 0.4}
                opacity={isHi ? 0.6 : 0.15}
              />
            );
          })}
          {/* nodes */}
          {nodes.map(n => {
            const p = positioned.get(n.id); if (!p) return null;
            const isMe = n.type === 'me';
            const isProj = n.type === 'project';
            const dim = highlight && !highlight.has(n.id);
            return (
              <g key={n.id}
                 transform={`translate(${p.x},${p.y})`}
                 style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.15s' }}
                 onMouseEnter={() => setHovered(n.id)}
                 onMouseLeave={() => setHovered(null)}
                 onClick={(e) => { e.stopPropagation(); setPinned(p2 => p2 === n.id ? null : n.id); }}
              >
                {isMe && <circle r={n.r + 8} fill="var(--accent)" opacity="0.18"/>}
                <circle r={n.r} fill={colorFor(n)} stroke={isMe ? 'var(--accent)' : isProj ? 'var(--text)' : 'none'} strokeWidth={isMe ? 2 : 0}/>
                {n.overdue > 0 && (
                  <circle r="3" cx={n.r * 0.7} cy={-n.r * 0.7} fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.2"/>
                )}
                {(isMe || isProj || (granularity !== 'tareas')) && (
                  <text
                    x="0" y={n.r + 14}
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize={isMe ? 14 : isProj ? 12 : 10}
                    fontWeight={isMe ? 600 : isProj ? 500 : 400}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.label.length > 26 ? n.label.slice(0, 24) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Detail panel — bottom right */}
        {activeNode && (
          <div className="card" style={{ position: 'absolute', right: 20, bottom: 20, width: 320, padding: 16, boxShadow: 'var(--shadow-md)' }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: colorFor(activeNode) }}/>
              <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {activeNode.type === 'me' ? 'Usuario' : activeNode.type === 'project' ? 'Proyecto' : activeNode.type === 'product' ? 'Producto' : 'Tarea'}
              </span>
              <span className="spacer"/>
              {pinned && <button className="icon-btn" onClick={() => setPinned(null)}><Icon name="close" size={12}/></button>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.25 }}>{activeNode.label}</div>
            {activeNode.type === 'project' && (() => {
              const proj = projects.find(p => p.id === activeNode.id);
              return proj ? (
                <>
                  <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <Pill kind="">{proj.products} productos</Pill>
                    <Pill kind="">{proj.tasks} tareas</Pill>
                    {proj.overdue > 0 && <Pill kind="danger" dot={false}>{proj.overdue} vencidas</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>{proj.desc}</div>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Progreso</span>
                    <span className="spacer"/>
                    <span className="mono" style={{ fontSize: 11 }}>{Math.round(proj.progress*100)}%</span>
                  </div>
                  <Bar value={proj.progress}/>
                </>
              ) : null;
            })()}
            {activeNode.type === 'product' && (
              <div className="row" style={{ gap: 6 }}>
                <StatusPill status={activeNode.status}/>
              </div>
            )}
            {activeNode.type === 'me' && (
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Conectado a {edges.filter(e => e.from==='rsg' || e.to==='rsg').length} proyectos.</div>
            )}
          </div>
        )}

        {/* zoom hint */}
        <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 11, color: 'var(--text-3)' }} className="mono">
          {nodes.length} nodos · {edges.length} conexiones
        </div>
      </div>
    </div>
  );
}

window.CanvasView = CanvasView;
