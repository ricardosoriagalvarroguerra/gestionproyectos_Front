/* global React, Icon, Pill, StatusPill, Avatar, Bar, fmtDate, daysBetween, TODAY */
const { useState: useState_panel, useMemo: useMemo_panel } = React;

function Panel({ goProject, density }) {
  const { projects, tasks, users } = window.APP_DATA;
  const [filter, setFilter] = useState_panel('todas'); // todas | semana | vencidas | urgentes
  const [query, setQuery] = useState_panel('');

  const filtered = useMemo_panel(() => {
    let xs = tasks.slice().sort((a,b) => a.date.localeCompare(b.date));
    if (filter === 'semana') {
      xs = xs.filter(t => {
        const d = daysBetween(TODAY, t.date);
        return d >= 0 && d <= 7;
      });
    } else if (filter === 'vencidas') {
      xs = xs.filter(t => t.vencida);
    } else if (filter === 'urgentes') {
      xs = xs.filter(t => t.importance === 'alta');
    }
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(t => t.name.toLowerCase().includes(q));
    }
    return xs;
  }, [filter, query]);

  // group by date bucket
  const grouped = useMemo_panel(() => {
    const buckets = { 'Vencidas': [], 'Esta semana': [], 'Próximas': [], 'Más adelante': [] };
    filtered.forEach(t => {
      const d = daysBetween(TODAY, t.date);
      if (d < 0) buckets['Vencidas'].push(t);
      else if (d <= 7) buckets['Esta semana'].push(t);
      else if (d <= 30) buckets['Próximas'].push(t);
      else buckets['Más adelante'].push(t);
    });
    return Object.entries(buckets).filter(([k, v]) => v.length > 0);
  }, [filtered]);

  // Calculations for stats
  const totalOverdue = tasks.filter(t => t.vencida).length;
  const thisWeek = tasks.filter(t => {
    const d = daysBetween(TODAY, t.date);
    return d >= 0 && d <= 7;
  }).length;
  const activeProjects = projects.filter(p => p.progress > 0 && p.progress < 1).length;

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className="page-eyebrow">Proyectos · Vista general</div>
      </div>
      <h1 className="page-title">Buenos días, Ricardo</h1>
      <p className="page-subtitle">Lunes 11 de mayo · {thisWeek} tareas para esta semana · <span className="muted-2">{totalOverdue} vencidas pendientes</span></p>

      {/* Quick stats — Notion-style inline numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '8px 0 24px' }}>
        {[
          { label: 'Proyectos activos', value: activeProjects, total: projects.length, k: 'projects' },
          { label: 'Tareas vencidas', value: totalOverdue, kind: 'danger' },
          { label: 'Esta semana', value: thisWeek },
          { label: 'En foco', value: tasks.length, hint: 'tareas con seguimiento' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: s.kind === 'danger' ? 'var(--accent-text)' : 'var(--text)', lineHeight: 1 }}>
              {s.value}
              {s.total != null && <span style={{ fontSize: 14, color: 'var(--text-3)' }}> / {s.total}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: density === 'compact' ? '300px 1fr' : '340px 1fr', gap: 24 }}>
        {/* Left: projects */}
        <div>
          <div className="section-title">Proyectos<span className="count">{projects.length}</span></div>
          <div className="v-stack" style={{ gap: 4 }}>
            {projects.map(p => (
              <div
                key={p.id}
                className="card card-pad"
                style={{ cursor: 'pointer', padding: '10px 12px' }}
                onClick={() => goProject(p.id)}
              >
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="ico" style={{ color: 'var(--text-3)' }}><Icon name="file" size={13}/></span>
                  <span className="truncate" style={{ fontWeight: 500, fontSize: 13.5 }}>{p.name}</span>
                  <span className="spacer"/>
                  {p.overdue > 0 && <Pill kind="danger" dot={false}>{p.overdue}</Pill>}
                </div>
                <div className="row mono" style={{ fontSize: 11, color: 'var(--text-3)', gap: 12 }}>
                  <span>{p.products} prod</span>
                  <span>{p.tasks} tar</span>
                  <span className="spacer"/>
                  <span style={{ color: p.progress > 0.5 ? 'var(--success)' : 'var(--text-3)' }}>{Math.round(p.progress*100)}%</span>
                </div>
                <div style={{ marginTop: 6 }}><Bar value={p.progress} kind={p.progress >= 1 ? 'success' : ''}/></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: tasks in focus */}
        <div>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>En foco<span className="count">{filtered.length}</span></div>
            <span className="spacer"/>
            <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 7, padding: 2, gap: 0 }}>
              {[['todas','Todas'],['semana','Esta semana'],['vencidas','Vencidas'],['urgentes','Urgentes']].map(([k,l]) => (
                <button
                  key={k} className="tb-tab"
                  style={k === filter ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}}
                  onClick={() => setFilter(k)}
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {grouped.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>Sin tareas en este filtro.</div>
            )}
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                  <span>{bucket}</span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>{items.length}</span>
                </div>
                {items.map(t => {
                  const proj = projects.find(p => p.id === t.project);
                  const overdueDays = daysBetween(t.date, TODAY);
                  const assignee = t.assignee ? users.find(u => u.id === t.assignee) : null;
                  return (
                    <div key={t.id} className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 12, cursor: 'pointer' }}>
                      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: t.vencida ? 'var(--accent)' : t.status === 'en-curso' ? 'var(--info)' : 'var(--text-4)' }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.name}</div>
                        <div className="row" style={{ gap: 8, marginTop: 2, fontSize: 11.5, color: 'var(--text-3)' }}>
                          <span className="truncate">{proj?.name}</span>
                          <span>·</span>
                          <StatusPill status={t.status}/>
                          {t.importance === 'alta' && <Pill kind="warn" dot={false}>Alta</Pill>}
                        </div>
                      </div>
                      <div style={{ width: 28 }}>{assignee && <Avatar user={assignee} size={22}/>}</div>
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div className="mono" style={{ fontSize: 12, color: t.vencida ? 'var(--accent-text)' : 'var(--text-2)' }}>{fmtDate(t.date)}</div>
                        {t.vencida && <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>−{overdueDays} d</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Panel = Panel;
