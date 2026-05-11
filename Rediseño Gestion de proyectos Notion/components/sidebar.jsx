/* global React, Icon */
const { useState: useState_sb } = React;

function Sidebar({ view, setView, selectedProject, onSelectProject }) {
  const [open, setOpen] = useState_sb({ proyectos: true, vistas: true, equipo: false });
  const projects = window.APP_DATA.projects;
  const users = window.APP_DATA.users;

  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));

  return (
    <aside className="sidebar scroll-y">
      <div className="sb-ws">
        <span className="sb-ws-badge">VPF</span>
        <span className="sb-ws-meta"><b>Seguimiento</b><span>Workspace</span></span>
      </div>

      <div className="sb-search" onClick={() => alert('Buscar (Cmd K)')}>
        <Icon name="search" size={14}/>
        <span>Buscar</span>
        <kbd>⌘K</kbd>
      </div>

      <button className={`sb-item ${view==='panel' ? 'active' : ''}`} onClick={() => setView('panel')}>
        <span className="caret" style={{ visibility: 'hidden' }}/>
        <span className="ico"><Icon name="home" size={15}/></span>
        <span className="lbl">Panel</span>
      </button>
      <button className={`sb-item ${view==='canvas' ? 'active' : ''}`} onClick={() => setView('canvas')}>
        <span className="caret" style={{ visibility: 'hidden' }}/>
        <span className="ico"><Icon name="graph" size={15}/></span>
        <span className="lbl">Canvas</span>
      </button>
      <button className={`sb-item ${view==='carga' ? 'active' : ''}`} onClick={() => setView('carga')}>
        <span className="caret" style={{ visibility: 'hidden' }}/>
        <span className="ico"><Icon name="chart" size={15}/></span>
        <span className="lbl">Carga</span>
      </button>

      <div className="sb-section">Proyectos</div>

      <button className={`sb-item ${open.proyectos ? 'open' : ''}`} onClick={() => toggle('proyectos')}>
        <span className="caret"><Icon name="caret" size={12}/></span>
        <span className="ico"><Icon name="folder" size={14}/></span>
        <span className="lbl">Todos</span>
        <span className="meta">{projects.length}</span>
      </button>
      {open.proyectos && (
        <div className="sb-children">
          {projects.map(p => (
            <button
              key={p.id}
              className={`sb-item ${view==='project' && selectedProject===p.id ? 'active' : ''}`}
              onClick={() => { onSelectProject(p.id); setView('project'); }}
              title={p.fullName || p.name}
            >
              <span className="caret" style={{ visibility: 'hidden' }}/>
              <span className="ico"><Icon name="file" size={13}/></span>
              <span className="lbl">{p.name}</span>
              {p.overdue > 0 && <Pill kind="danger" dot={false}>{p.overdue}</Pill>}
            </button>
          ))}
        </div>
      )}

      <div className="sb-section">Equipo</div>
      <button className={`sb-item ${open.equipo ? 'open' : ''}`} onClick={() => toggle('equipo')}>
        <span className="caret"><Icon name="caret" size={12}/></span>
        <span className="ico"><Icon name="layers" size={14}/></span>
        <span className="lbl">Usuarios</span>
        <span className="meta">{users.length}</span>
      </button>
      {open.equipo && (
        <div className="sb-children">
          {users.slice(0, 8).map(u => (
            <button key={u.id} className="sb-item">
              <span className="caret" style={{ visibility: 'hidden' }}/>
              <Avatar user={u} size={16}/>
              <span className="lbl" style={{ marginLeft: 2 }}>{u.name}{u.me ? ' (yo)' : ''}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }}/>
      <div className="sb-section" style={{ paddingTop: 8 }}>Acciones</div>
      <button className="sb-item"><span className="caret" style={{ visibility: 'hidden' }}/><span className="ico"><Icon name="bell" size={14}/></span><span className="lbl">Actividad</span></button>
      <button className="sb-item"><span className="caret" style={{ visibility: 'hidden' }}/><span className="ico"><Icon name="settings" size={14}/></span><span className="lbl">Ajustes</span></button>
    </aside>
  );
}

function Topbar({ crumb, theme, setTheme, rightSlot }) {
  return (
    <div className="topbar">
      <div className="crumb">
        {crumb.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {c.onClick ? <a onClick={c.onClick}>{c.label}</a> : <span className={i === crumb.length - 1 ? 'here' : ''}>{c.label}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="tb-spacer"/>
      {rightSlot}
      <span className="theme-toggle">
        <button className={theme==='system' ? 'active' : ''} onClick={() => setTheme('system')} title="Sistema"><Icon name="monitor" size={13}/></button>
        <button className={theme==='light' ? 'active' : ''} onClick={() => setTheme('light')} title="Claro"><Icon name="sun" size={13}/></button>
        <button className={theme==='dark' ? 'active' : ''} onClick={() => setTheme('dark')} title="Oscuro"><Icon name="moon" size={13}/></button>
      </span>
      <span className="user-chip">
        <Avatar user={window.APP_DATA.users[0]}/>
        <span>Ricardo</span>
      </span>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar });
