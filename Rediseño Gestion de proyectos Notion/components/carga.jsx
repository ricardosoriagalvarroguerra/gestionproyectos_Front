/* global React, Icon, Avatar */
const { useState: useState_carga, useMemo: useMemo_carga } = React;

// Gantt-style horizontal workload timeline grouped by person/team
function Carga() {
  const { users, carga, projects } = window.APP_DATA;
  const [scope, setScope] = useState_carga('mes'); // mes | trimestre
  const [team, setTeam] = useState_carga('all');

  // Build weekly bars — for each user, blocks across week columns
  const filteredUsers = users.filter(u => team === 'all' || u.team === team);
  const teams = ['all', ...Array.from(new Set(users.map(u => u.team)))];

  const weeks = carga.weeks;
  const cap = carga.capacity;

  // Color scale for workload intensity
  const intensity = (h) => {
    if (h === 0) return null;
    const t = Math.min(1, h / cap);
    if (t < 0.4) return 'var(--info-soft)';
    if (t < 0.75) return 'var(--info)';
    if (t < 1) return 'var(--accent)';
    return 'var(--accent)';
  };

  // Aggregate by team
  const teamTotals = useMemo_carga(() => {
    const t = {};
    users.forEach(u => {
      const row = carga.rows.find(r => r.user === u.id);
      if (!row) return;
      t[u.team] = t[u.team] || { sum: weeks.map(() => 0), count: 0 };
      row.hours.forEach((h, i) => t[u.team].sum[i] += h);
      t[u.team].count++;
    });
    return t;
  }, []);

  // Group rows by team
  const grouped = useMemo_carga(() => {
    const g = {};
    filteredUsers.forEach(u => { (g[u.team] = g[u.team] || []).push(u); });
    return g;
  }, [team]);

  return (
    <div className="content">
      <div className="page-eyebrow">Equipo · Carga semanal</div>
      <h1 className="page-title">Carga semanal por usuario</h1>
      <p className="page-subtitle">Horas asignadas vs capacidad ({cap} h/sem). Mayo 2026 · {users.length} usuarios.</p>

      {/* Controls */}
      <div className="row" style={{ gap: 12, marginBottom: 18 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Mes</span>
          <button className="btn" style={{ height: 28 }}>Mayo 2026 <Icon name="caret" size={10}/></button>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Equipo</span>
          <div className="row" style={{ background: 'var(--surface-2)', padding: 2, borderRadius: 7 }}>
            {teams.map(t => (
              <button key={t} className="tb-tab" style={team===t ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}} onClick={() => setTeam(t)}>
                {t === 'all' ? 'Todos' : t}
              </button>
            ))}
          </div>
        </div>
        <span className="spacer"/>
        <div className="row" style={{ background: 'var(--surface-2)', padding: 2, borderRadius: 7 }}>
          {[['mes','Mes'],['trimestre','Trimestre']].map(([k,l]) => (
            <button key={k} className="tb-tab" style={scope===k ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : {}} onClick={() => setScope(k)}>{l}</button>
          ))}
        </div>
        <button className="btn"><Icon name="download" size={13}/>Exportar</button>
      </div>

      {/* Summary band */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div className="row" style={{ gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Promedio del equipo</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500 }}>
              {Math.round(carga.rows.reduce((s,r) => s + r.hours.reduce((a,b)=>a+b,0), 0) / (carga.rows.length * weeks.length))}<span style={{ fontSize: 13, color: 'var(--text-3)' }}> h/sem</span>
            </div>
          </div>
          <div style={{ height: 32, width: 1, background: 'var(--border)' }}/>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sobre-asignados</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: 'var(--accent-text)' }}>
              {carga.rows.filter(r => r.hours.some(h => h >= cap)).length}
            </div>
          </div>
          <div style={{ height: 32, width: 1, background: 'var(--border)' }}/>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sin asignación</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-3)' }}>
              {carga.rows.filter(r => r.hours.every(h => h === 0)).length}
            </div>
          </div>
          <div className="spacer"/>
          {/* legend */}
          <div className="row" style={{ gap: 12, fontSize: 11.5, color: 'var(--text-3)' }}>
            <div className="row" style={{ gap: 4 }}><span style={{ width: 14, height: 10, background: 'var(--info-soft)', borderRadius: 2 }}/>&lt;40%</div>
            <div className="row" style={{ gap: 4 }}><span style={{ width: 14, height: 10, background: 'var(--info)', borderRadius: 2 }}/>40-75%</div>
            <div className="row" style={{ gap: 4 }}><span style={{ width: 14, height: 10, background: 'var(--accent)', borderRadius: 2 }}/>&gt;75%</div>
          </div>
        </div>
      </div>

      {/* Gantt timeline */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${weeks.length}, 1fr)`, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario</div>
          {weeks.map(w => (
            <div key={w.id} style={{ padding: '10px 14px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{w.label}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{w.range}</div>
            </div>
          ))}
        </div>

        {/* rows per team */}
        {Object.entries(grouped).map(([t, us]) => (
          <React.Fragment key={t}>
            {/* team aggregate row */}
            <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${weeks.length}, 1fr)`, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ padding: '8px 14px', gap: 6 }}>
                <Icon name="caret" size={10}/>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{us.length}</span>
              </div>
              {weeks.map((w, i) => {
                const total = (teamTotals[t]?.sum[i] || 0);
                return (
                  <div key={i} style={{ padding: '6px 14px', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{total} h</span>
                  </div>
                );
              })}
            </div>
            {/* user rows */}
            {us.map(u => {
              const row = carga.rows.find(r => r.user === u.id);
              if (!row) return null;
              return (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: `220px repeat(${weeks.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ padding: '6px 14px', gap: 8 }}>
                    <Avatar user={u} size={22}/>
                    <span className="truncate" style={{ fontSize: 13 }}>{u.name}{u.me ? <span style={{ color: 'var(--text-3)' }}> · tú</span> : ''}</span>
                  </div>
                  {row.hours.map((h, i) => {
                    const fill = intensity(h);
                    const pct = Math.min(1, h / cap);
                    return (
                      <div key={i} style={{ position: 'relative', borderLeft: '1px solid var(--border)', padding: '6px 8px', height: 36, display: 'flex', alignItems: 'center' }}>
                        {h > 0 && (
                          <div className="tip" data-tip={`${u.name} · ${h} h / ${cap} h · ${Math.round(pct*100)}%`} style={{ width: '100%', height: 18, background: 'var(--surface-2)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, pct*100)}%`, height: '100%', background: fill, borderRadius: 4 }}/>
                            <span className="mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10.5, color: pct > 0.5 ? 'white' : 'var(--text-2)', fontWeight: 500 }}>{h}h</span>
                          </div>
                        )}
                        {h === 0 && <span style={{ fontSize: 11, color: 'var(--text-4)' }} className="mono">—</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

window.Carga = Carga;
