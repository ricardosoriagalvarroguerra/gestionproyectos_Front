/* global React, Icon, Pill, StatusPill, Avatar, Bar, fmtDate, fmtDateShort, TODAY */
const { useState: useState_pd, useMemo: useMemo_pd } = React;

function ProjectDetail({ projectId, back, goProject }) {
  const { projects, products, projectTasks, users } = window.APP_DATA;
  const proj = projects.find(p => p.id === projectId) || projects[0];
  const prods = products[proj.id] || products['flujo-automatizacion-datos'];
  const tasks = projectTasks;

  const [tab, setTab] = useState_pd('cronograma'); // cronograma | productos | tareas
  const [tasksFilter, setTasksFilter] = useState_pd('todas');
  const [productFilter, setProductFilter] = useState_pd('todos');
  const [year, setYear] = useState_pd(2026);

  // Build task months scale (Dec → Jun)
  const monthCols = [
    { m: 'Dec', weeks: ['29/12-11/01'] },
    { m: 'Jan', weeks: ['12/01-25/01', '26/01-8/02'] },
    { m: 'Feb', weeks: ['9/02-22/02', '23/02-8/03'] },
    { m: 'Mar', weeks: ['9/03-22/03', '30/03-12/04'] },
    { m: 'Apr', weeks: ['13/04-26/04', '27/04-10/05'] },
    { m: 'May', weeks: ['11/05-24/05'] },
    { m: 'Jun', weeks: ['1/06-14/06', '15/06-28/06'] },
  ];
  // Flatten week array with absolute index → date range start
  const allWeeks = monthCols.flatMap(m => m.weeks);
  const todayWeekIdx = 9; // 11/05-24/05

  // Compute which task occupies which week
  const weekStartDates = ['2025-12-29','2026-01-12','2026-01-26','2026-02-09','2026-02-23','2026-03-09','2026-03-30','2026-04-13','2026-04-27','2026-05-11','2026-06-01','2026-06-15'];
  const taskBars = useMemo_pd(() => tasks.map(t => {
    let startW = 0, endW = 0;
    for (let i = 0; i < weekStartDates.length - 1; i++) {
      if (t.start >= weekStartDates[i] && t.start < weekStartDates[i+1]) startW = i;
      if (t.end >= weekStartDates[i] && t.end < weekStartDates[i+1]) endW = i;
    }
    if (t.end >= weekStartDates[weekStartDates.length-1]) endW = weekStartDates.length - 1;
    return { ...t, startW, endW };
  }), []);

  const tasksGrouped = useMemo_pd(() => {
    const g = {};
    tasks.filter(t => productFilter === 'todos' || t.group === productFilter).forEach(t => {
      (g[t.group] = g[t.group] || []).push(t);
    });
    return Object.entries(g);
  }, [productFilter]);

  const taskStatusBg = (s) => s === 'listo' ? 'var(--success-soft)' : s === 'en-curso' ? 'var(--info-soft)' : 'var(--surface-3)';
  const taskStatusBd = (s) => s === 'listo' ? 'var(--success)' : s === 'en-curso' ? 'var(--info)' : 'var(--text-4)';

  return (
    <div className="content" style={{ maxWidth: 1320 }}>
      <div className="page-eyebrow"><a onClick={back} style={{ cursor: 'pointer' }}>Proyectos</a> / Detalle</div>
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 8 }}>{proj.fullName || proj.name}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            <span className="mono">{fmtDate(proj.start)}</span> → <span className="mono">{fmtDate(proj.end)}</span>
            <span className="muted"> · {proj.desc}</span>
          </p>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Pill kind=""><span className="dot"/>{proj.products} productos</Pill>
            <Pill kind=""><span className="dot"/>{proj.tasks} tareas</Pill>
            {proj.overdue > 0 && <Pill kind="danger" dot={false}>{proj.overdue} vencidas</Pill>}
            <div className="row" style={{ marginLeft: 10, gap: 4 }}>
              {proj.team.map(uid => { const u = users.find(x => x.id === uid); return u ? <Avatar key={uid} user={u} size={22}/> : null; })}
            </div>
          </div>
        </div>
        <div style={{ width: 280 }}>
          <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
            <Icon name="search" size={14}/>
            <input placeholder="Buscar producto o tarea…" style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}/>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" title="Abrir en Notion"><Icon name="notion" size={14}/></button>
            <button className="btn" style={{ height: 30 }}><Icon name="download" size={13}/>Exportar</button>
            <button className="btn accent" style={{ height: 30, marginLeft: 'auto' }}><Icon name="refresh" size={13}/>Sincronizar</button>
          </div>
        </div>
      </div>

      {/* KPI band — compact, inline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '20px 0 24px' }}>
        {[
          { label: 'Progreso', value: `${Math.round(proj.progress*100)}%` },
          { label: 'Tareas', value: proj.tasks },
          { label: 'Vencidas', value: proj.overdue, kind: 'danger' },
          { label: 'Productos', value: proj.products },
          { label: 'Listos', value: proj.productsDone },
          { label: 'Equipo', value: proj.team.length },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: s.kind === 'danger' ? 'var(--accent-text)' : 'var(--text)', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="row" style={{ borderBottom: '1px solid var(--border)', marginBottom: 16, gap: 4 }}>
        {[['cronograma','Cronograma'],['productos','Productos'],['tareas','Tareas']].map(([k,l]) => (
          <button key={k}
            onClick={() => setTab(k)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 14px', fontSize: 13.5, fontWeight: 500,
              color: tab === k ? 'var(--text)' : 'var(--text-3)',
              borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{l}</button>
        ))}
      </div>

      {tab === 'cronograma' && (
        <div>
          {/* timeline controls */}
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="row" style={{ background: 'var(--surface-2)', padding: 2, borderRadius: 7 }}>
              {[['cronograma','Tareas'],['productos','Productos']].map(([k,l]) => (
                <button key={k} className="tb-tab" style={k==='cronograma' ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}}>{l}</button>
              ))}
            </div>
            <span className="spacer"/>
            <div className="row" style={{ gap: 6 }}>
              <button className="icon-btn"><Icon name="caret" size={12} style={{ transform: 'rotate(180deg)' }}/></button>
              <span className="mono" style={{ fontSize: 13, padding: '0 12px' }}>{year}</span>
              <button className="icon-btn"><Icon name="caret" size={12}/></button>
              <button className="btn" style={{ height: 28 }}>Hoy</button>
              <button className="icon-btn"><Icon name="expand" size={13}/></button>
            </div>
          </div>

          {/* Timeline */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${allWeeks.length}, minmax(70px, 1fr))`, borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Item / Semana</div>
              {/* month row spans */}
              {monthCols.map((mc, i) => (
                <div key={i} style={{ gridColumn: `span ${mc.weeks.length}`, padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>{mc.m}</div>
              ))}
              <div/>
              {allWeeks.map((w, i) => (
                <div key={i} className="mono" style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10, color: i === todayWeekIdx ? 'var(--accent-text)' : 'var(--text-3)', borderLeft: '1px solid var(--border)', background: i === todayWeekIdx ? 'var(--accent-soft)' : 'transparent', fontWeight: i === todayWeekIdx ? 500 : 400 }}>{w}</div>
              ))}
            </div>

            {/* Groups & task rows */}
            {tasksGrouped.map(([group, items]) => (
              <React.Fragment key={group}>
                <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${allWeeks.length}, minmax(70px, 1fr))`, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group}</div>
                  {allWeeks.map((_, i) => <div key={i} style={{ borderLeft: '1px solid var(--border)' }}/>)}
                </div>
                {items.map((t, ti) => (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: `260px repeat(${allWeeks.length}, minmax(70px, 1fr))`, borderBottom: '1px solid var(--border)' }}>
                    <div className="row" style={{ padding: '8px 12px', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: taskStatusBd(t.status), flex: 'none' }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 12.5 }}>{t.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{STATUS[t.status].label}</div>
                      </div>
                    </div>
                    {allWeeks.map((_, i) => {
                      const inBar = i >= t.startW && i <= t.endW;
                      const isLeft = i === t.startW;
                      const isRight = i === t.endW;
                      const isToday = i === todayWeekIdx;
                      return (
                        <div key={i} style={{ borderLeft: '1px solid var(--border)', padding: '8px 4px', position: 'relative', background: isToday ? 'var(--accent-soft)' : 'transparent', height: 38, display: 'flex', alignItems: 'center' }}>
                          {inBar && (
                            <div style={{
                              flex: 1, height: 18,
                              background: taskStatusBg(t.status),
                              borderLeft: isLeft ? `2px solid ${taskStatusBd(t.status)}` : 'none',
                              borderRight: isRight ? `2px solid ${taskStatusBd(t.status)}` : 'none',
                              borderTopLeftRadius: isLeft ? 3 : 0, borderBottomLeftRadius: isLeft ? 3 : 0,
                              borderTopRightRadius: isRight ? 3 : 0, borderBottomRightRadius: isRight ? 3 : 0,
                              marginRight: isRight ? 0 : -8, marginLeft: isLeft ? 0 : -8,
                            }}/>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {tab === 'productos' && (
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>Productos<span className="count">{prods.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {prods.map(p => (
              <div key={p.id} className="card card-pad" style={{ cursor: 'pointer' }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <Icon name="layers" size={14}/>
                  <span style={{ fontWeight: 500, fontSize: 13.5 }}>{p.fullName || p.name}</span>
                </div>
                <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                  <StatusPill status={p.status}/>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.tasks} tareas</span>
                </div>
                <Bar value={p.progress} kind={p.progress >= 1 ? 'success' : ''}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tareas' && (
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Tareas<span className="count">{tasks.length}</span></div>
            <span className="spacer"/>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Producto</span>
            <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="btn" style={{ height: 30, fontFamily: 'inherit' }}>
              <option value="todos">Todos</option>
              {Array.from(new Set(tasks.map(t => t.group))).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <div className="row" style={{ background: 'var(--surface-2)', padding: 2, borderRadius: 7 }}>
              {[['todas','Todas'],['vencidas','Vencidas'],['urgentes','Urgentes']].map(([k,l]) => (
                <button key={k} className="tb-tab" style={tasksFilter===k ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}} onClick={() => setTasksFilter(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tarea</th><th>Estado</th><th>Importancia</th><th>Asignado</th><th>Fecha</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tasksGrouped.map(([group, items]) => (
                  <React.Fragment key={group}>
                    <tr>
                      <td colSpan="6" style={{ background: 'var(--surface-2)', padding: '8px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group}</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{items.length} tareas</span>
                      </td>
                    </tr>
                    {items.map(t => {
                      const u = t.assignee ? users.find(x => x.id === t.assignee) : null;
                      return (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td><StatusPill status={t.status}/></td>
                          <td>{t.importance === 'alta' ? <Pill kind="warn" dot={false}>Alta</Pill> : <Pill dot={false}>Normal</Pill>}</td>
                          <td>{u ? <span className="row" style={{ gap: 6 }}><Avatar user={u} size={20}/>{u.name.split(' ')[0]}</span> : <span className="muted">Sin asignar</span>}</td>
                          <td className="mono nowrap" style={{ fontSize: 12 }}>
                            {fmtDateShort(t.start)} – {fmtDateShort(t.end)}
                            {t.overdueDays && <div style={{ fontSize: 10.5, color: 'var(--accent-text)' }}>Atrasada {t.overdueDays} d</div>}
                          </td>
                          <td/>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

window.ProjectDetail = ProjectDetail;
