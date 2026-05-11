/* global React, Sidebar, Topbar, Panel, CanvasView, Carga, ProjectDetail */
const { useState: useState_app, useEffect: useEffect_app } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "rojo",
  "density": "compact",
  "navStyle": "sidebar",
  "fontHeading": "geist"
}/*EDITMODE-END*/;

function App() {
  const [view, setView] = useState_app('panel'); // panel | canvas | carga | project
  const [selectedProject, setSelectedProject] = useState_app('flujo-automatizacion-datos');
  const [theme, setTheme] = useState_app(() => {
    const saved = localStorage.getItem('gp-theme');
    return saved || 'dark';
  });
  const [density, setDensity] = useState_app('compact');

  useEffect_app(() => {
    const apply = (t) => {
      const real = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t;
      document.documentElement.setAttribute('data-theme', real);
    };
    apply(theme);
    localStorage.setItem('gp-theme', theme);
  }, [theme]);

  const goProject = (id) => { setSelectedProject(id); setView('project'); };

  const crumb = (() => {
    if (view === 'panel') return [{ label: 'Seguimiento' }, { label: 'Panel' }];
    if (view === 'canvas') return [{ label: 'Seguimiento' }, { label: 'Canvas' }];
    if (view === 'carga') return [{ label: 'Seguimiento' }, { label: 'Carga' }];
    if (view === 'project') {
      const p = window.APP_DATA.projects.find(x => x.id === selectedProject);
      return [{ label: 'Seguimiento' }, { label: 'Proyectos', onClick: () => setView('panel') }, { label: p?.name || 'Proyecto' }];
    }
    return [];
  })();

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={setView}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
      />
      <main className="main">
        <Topbar
          crumb={crumb}
          theme={theme}
          setTheme={setTheme}
        />
        {view === 'panel' && <Panel goProject={goProject} density={density}/>}
        {view === 'canvas' && <CanvasView/>}
        {view === 'carga' && <Carga/>}
        {view === 'project' && <ProjectDetail projectId={selectedProject} back={() => setView('panel')} goProject={goProject}/>}
      </main>
    </div>
  );
}

window.App = App;
