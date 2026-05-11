// Mock dataset — projects, products, tasks, users
window.APP_DATA = (() => {
  const users = [
    { id: 'rsg', name: 'Ricardo Soria Galvarro', initials: 'RS', team: 'VP', me: true },
    { id: 'mm', name: 'Matias Mednik', initials: 'MM', team: 'VP' },
    { id: 'am', name: 'Alvaro Miranda', initials: 'AM', team: 'VP' },
    { id: 'rr', name: 'Rafael Robles', initials: 'RR', team: 'VP' },
    { id: 'aj', name: 'Antonio Juanbeltz', initials: 'AJ', team: 'Otros' },
    { id: 'mr', name: 'Maximiliano Reherman', initials: 'MR', team: 'Otros' },
    { id: 'cb', name: 'Carolina Britos', initials: 'CB', team: 'COF' },
    { id: 'gr', name: 'Gabriela Rocha', initials: 'GR', team: 'COF' },
    { id: 'gp', name: 'Gabriel Paredes', initials: 'GP', team: 'COF' },
    { id: 'hn', name: 'Helga Niesser', initials: 'HN', team: 'COF' },
    { id: 'ph', name: 'Pablo Hermosa', initials: 'PH', team: 'COF' },
  ];

  const projects = [
    {
      id: 'reporting-vpf', name: 'Reporting VPF',
      products: 4, productsDone: 2, tasks: 21, overdue: 2, progress: 0.667,
      start: '2025-09-01', end: '2026-08-30',
      lead: 'rsg', team: ['rsg','mm'],
      desc: 'Reportería ejecutiva y operativa para la Vicepresidencia.',
    },
    {
      id: 'condiciones-financieras-2026', name: 'Condiciones Financieras 2026',
      products: 14, productsDone: 0, tasks: 44, overdue: 0, progress: 0.0,
      start: '2026-01-01', end: '2026-12-31',
      lead: 'am', team: ['am','rsg'],
      desc: 'Definición y monitoreo de condiciones financieras del año fiscal 2026.',
    },
    {
      id: 'estrategia-financiamiento',
      name: 'Estratégia Financiamiento P…',
      fullName: 'Estrategia Financiamiento Programado',
      products: 0, productsDone: 0, tasks: 0, overdue: 0, progress: 0,
      start: '2026-02-01', end: '2026-12-15',
      lead: 'mm', team: ['mm'],
      desc: 'Marco estratégico para financiamiento programado multianual.',
    },
    {
      id: 'transformacion-tecnologica-vpf', name: 'Transformación Tecnológica VPF',
      products: 5, productsDone: 1, tasks: 23, overdue: 6, progress: 0.20,
      start: '2025-11-01', end: '2026-11-30',
      lead: 'rsg', team: ['rsg','mm','am'],
      desc: 'Modernización de la stack tecnológica de la VPF.',
    },
    {
      id: 'estrategia-endeudamiento', name: 'Estrategia de Endeudamiento',
      products: 4, productsDone: 2, tasks: 17, overdue: 0, progress: 0.588,
      start: '2025-08-01', end: '2026-06-30',
      lead: 'rr', team: ['rr','rsg'],
      desc: 'Marco estratégico para emisiones y endeudamiento programado.',
    },
    {
      id: 'fortalecimiento-capacidad-predictiva',
      name: 'Fortalecimiento Capacidad Predictiva',
      products: 6, productsDone: 1, tasks: 28, overdue: 4, progress: 0.36,
      start: '2025-10-15', end: '2026-10-30',
      lead: 'mr', team: ['mr','rsg'],
      desc: 'Modelos predictivos para riesgo soberano y supervivencia.',
    },
    {
      id: 'flujo-automatizacion-datos',
      name: 'Flujo y Automatización de Datos',
      products: 9, productsDone: 0, tasks: 49, overdue: 5, progress: 0.327,
      start: '2025-11-30', end: '2026-10-30',
      lead: 'rsg', team: ['rsg','mm'],
      desc: 'Pipeline end-to-end de ingesta, transformación y publicación de datos.',
    },
    {
      id: 'mapeo-vpf', name: 'Mapeo VPF',
      products: 2, productsDone: 0, tasks: 5, overdue: 1, progress: 0.10,
      start: '2026-01-15', end: '2026-05-30',
      lead: 'cb', team: ['cb'],
      desc: 'Levantamiento integral de procesos y stakeholders de la VPF.',
    },
    {
      id: 'apoyo-bolivia-crisis', name: 'Apoyo Bolivia Crisis',
      products: 1, productsDone: 0, tasks: 3, overdue: 0, progress: 0.05,
      start: '2026-03-01', end: '2026-06-30',
      lead: 'gr', team: ['gr','rsg'],
      desc: 'Operación para Liquidez de Rápido Desembolso.',
    },
  ];

  // Products by project id
  const products = {
    'flujo-automatizacion-datos': [
      { id: 'diag', name: 'Diagnóstico y Levantamiento de In…', fullName: 'Diagnóstico y Levantamiento de Información', status: 'listo', tasks: 6, progress: 1 },
      { id: 'arq', name: 'Arquitectura e Infraestructura', status: 'en-curso', tasks: 7, progress: 0.43 },
      { id: 'bronze', name: 'Capa Bronze - Ingesta de Datos', status: 'en-curso', tasks: 6, progress: 0.33 },
      { id: 'silver', name: 'Capa Silver - Transformación y Li…', fullName: 'Capa Silver - Transformación y Limpieza', status: 'sin-empezar', tasks: 5, progress: 0 },
      { id: 'gold', name: 'Capa Gold - Datos Curados y Model…', fullName: 'Capa Gold - Datos Curados y Modelado', status: 'sin-empezar', tasks: 5, progress: 0 },
      { id: 'auto', name: 'Automatización y Orquestación', status: 'sin-empezar', tasks: 5, progress: 0 },
      { id: 'viz', name: 'Visualización y Reporting', status: 'sin-empezar', tasks: 6, progress: 0 },
      { id: 'gov', name: 'Gobernanza de Datos', status: 'sin-empezar', tasks: 5, progress: 0 },
      { id: 'dw', name: 'Data Warehouse', status: 'sin-empezar', tasks: 4, progress: 0 },
    ],
    'fortalecimiento-capacidad-predictiva': [
      { id: 'redes', name: 'Modelo de Redes Neuronales', status: 'en-curso', tasks: 6, progress: 0.5 },
      { id: 'super', name: 'Modelo de Análisis de Supervivencia', status: 'en-curso', tasks: 5, progress: 0.4 },
      { id: 'proy', name: 'Sistema de proyecciones operativas', status: 'sin-empezar', tasks: 4, progress: 0 },
    ],
    'reporting-vpf': [
      { id: 'rng', name: 'Reporting Riesgo No Soberano', status: 'en-curso', tasks: 5, progress: 0.6 },
      { id: 'port', name: 'PORT ENTERPRISE', status: 'sin-empezar', tasks: 4, progress: 0 },
      { id: 'cov', name: 'Alerta de covenants', status: 'en-curso', tasks: 6, progress: 0.5 },
      { id: 'clientes', name: 'Reporting Clientes', status: 'listo', tasks: 6, progress: 1 },
    ],
  };

  // Tasks (focus list for Panel + project detail)
  const tasks = [
    { id: 't1', name: 'Preparar Entorno con los datos de FONPLATA y la última versión del…', project: 'transformacion-tecnologica-vpf', product: 'Entorno', date: '2025-12-30', status: 'en-curso', vencida: true, importance: 'alta', assignee: 'mm' },
    { id: 't2', name: 'Ejecución de pruebas de regresión + pruebas específicas basadas en la…', project: 'transformacion-tecnologica-vpf', product: 'QA', date: '2025-12-30', status: 'en-curso', vencida: true, importance: 'alta', assignee: 'am' },
    { id: 't3', name: 'Nos comparten los resultados de las pruebas (comparación de facturació…)', project: 'transformacion-tecnologica-vpf', product: 'QA', date: '2025-12-30', status: 'sin-empezar', vencida: true, importance: 'normal', assignee: null },
    { id: 't4', name: 'Benchmark IDB', project: 'transformacion-tecnologica-vpf', product: 'Benchmark', date: '2026-01-22', status: 'sin-empezar', vencida: true, importance: 'normal', assignee: 'rsg' },
    { id: 't5', name: 'Construcción del dataset "long" para supervivencia', project: 'fortalecimiento-capacidad-predictiva', product: 'super', date: '2026-01-25', status: 'en-curso', vencida: true, importance: 'alta', assignee: 'mr' },
    { id: 't6', name: 'Convertir supervivencia → curva de desembolsos', project: 'fortalecimiento-capacidad-predictiva', product: 'super', date: '2026-01-25', status: 'en-curso', vencida: true, importance: 'alta', assignee: 'rsg' },
    { id: 't7', name: 'Interpretabilidad & escenarios', project: 'fortalecimiento-capacidad-predictiva', product: 'redes', date: '2026-01-26', status: 'en-curso', vencida: true, importance: 'normal', assignee: 'mr' },
    { id: 't8', name: 'Capacitación UBO', project: 'transformacion-tecnologica-vpf', product: 'training', date: '2026-01-30', status: 'sin-empezar', vencida: true, importance: 'normal', assignee: null },
    { id: 't9', name: 'Definir split de datos (train/validation/test) con…', project: 'fortalecimiento-capacidad-predictiva', product: 'redes', date: '2026-02-27', status: 'sin-empezar', vencida: true, importance: 'normal', assignee: 'mr' },
    { id: 't10', name: 'Diseñar arquitectura base de la red', project: 'fortalecimiento-capacidad-predictiva', product: 'redes', date: '2026-03-09', status: 'sin-empezar', vencida: true, importance: 'alta', assignee: 'rsg' },
    { id: 't11', name: 'S&C to send comments to FONPLATA', project: 'condiciones-financieras-2026', product: 'cof', date: '2026-03-17', status: 'en-curso', vencida: true, importance: 'normal', assignee: 'cb' },
    { id: 't12', name: 'S&C circulates initial OM draft to investors', project: 'condiciones-financieras-2026', product: 'cof', date: '2026-03-19', status: 'sin-empezar', vencida: true, importance: 'normal', assignee: 'cb' },
  ];

  // Tasks for project "Flujo y Automatización de Datos"
  const projectTasks = [
    { id: 'pt1', group: 'Diagnóstico y Levantamiento de Información', name: 'Identificación de stakeholders y usuarios clave de datos', status: 'listo', importance: 'normal', assignee: 'rsg', start: '2026-01-01', end: '2026-01-30', overdueDays: 101 },
    { id: 'pt2', group: 'Diagnóstico y Levantamiento de Información', name: 'Inventario de sistemas fuente', status: 'listo', importance: 'normal', assignee: 'rsg', start: '2026-01-01', end: '2026-01-30', overdueDays: 101 },
    { id: 'pt3', group: 'Diagnóstico y Levantamiento de Información', name: 'Mapeo de flujos de datos actuales (inputs, transformaciones, outputs)', status: 'listo', importance: 'normal', assignee: 'rsg', start: '2026-02-01', end: '2026-03-18', overdueDays: 54 },
    { id: 'pt4', group: 'Diagnóstico y Levantamiento de Información', name: 'Análisis de brechas tecnológicas (herramientas actuales vs. necesarias)', status: 'listo', importance: 'normal', assignee: 'rsg', start: '2026-02-25', end: '2026-02-27', overdueDays: 73 },
    { id: 'pt5', group: 'Diagnóstico y Levantamiento de Información', name: 'Identificación de pain points y cuellos de botella en procesos manuales', status: 'listo', importance: 'normal', assignee: 'rsg', start: '2026-03-01', end: '2026-03-18', overdueDays: 54 },
    { id: 'pt6', group: 'Diagnóstico y Levantamiento de Información', name: 'Definición de requerimientos funcionales y no funcionales', status: 'listo', importance: 'alta', assignee: 'rsg', start: '2026-03-15', end: '2026-04-05', overdueDays: 35 },
    { id: 'pt7', group: 'Arquitectura e Infraestructura', name: 'Diseño de arquitectura de referencia', status: 'en-curso', importance: 'alta', assignee: 'mm', start: '2026-04-01', end: '2026-05-15' },
    { id: 'pt8', group: 'Arquitectura e Infraestructura', name: 'Provisionamiento de entornos (dev/staging/prod)', status: 'en-curso', importance: 'alta', assignee: 'mm', start: '2026-04-15', end: '2026-05-30' },
    { id: 'pt9', group: 'Arquitectura e Infraestructura', name: 'Definición de stack: orquestador, lakehouse, BI', status: 'listo', importance: 'normal', assignee: 'mm', start: '2026-03-20', end: '2026-04-10' },
    { id: 'pt10', group: 'Capa Bronze - Ingesta de Datos', name: 'Conexión a FONPLATA y sistemas legacy', status: 'en-curso', importance: 'alta', assignee: 'rsg', start: '2026-05-01', end: '2026-06-15' },
    { id: 'pt11', group: 'Capa Bronze - Ingesta de Datos', name: 'Pipelines de ingesta incremental', status: 'sin-empezar', importance: 'alta', assignee: null, start: '2026-05-20', end: '2026-07-01' },
    { id: 'pt12', group: 'Capa Silver - Transformación y Limpieza', name: 'Modelo dimensional para operaciones', status: 'sin-empezar', importance: 'normal', assignee: null, start: '2026-06-15', end: '2026-08-01' },
  ];

  // Workload — hours assigned per user per week
  const carga = {
    weeks: [
      { id: 'w1', label: 'Sem 1', range: '01-03 may' },
      { id: 'w2', label: 'Sem 2', range: '04-10 may' },
      { id: 'w3', label: 'Sem 3', range: '11-17 may' },
      { id: 'w4', label: 'Sem 4', range: '18-24 may' },
      { id: 'w5', label: 'Sem 5', range: '25-31 may' },
    ],
    rows: [
      { user: 'rsg', hours: [38, 42, 36, 34, 30] },
      { user: 'mm',  hours: [28, 32, 30, 26, 24] },
      { user: 'am',  hours: [12, 16, 18, 14, 10] },
      { user: 'rr',  hours: [0, 0, 0, 0, 0] },
      { user: 'aj',  hours: [22, 0, 0, 0, 0] },
      { user: 'mr',  hours: [0, 18, 22, 24, 20] },
      { user: 'cb',  hours: [16, 14, 18, 20, 22] },
      { user: 'gr',  hours: [0, 0, 0, 0, 0] },
      { user: 'gp',  hours: [0, 0, 0, 0, 0] },
      { user: 'hn',  hours: [0, 0, 0, 0, 0] },
      { user: 'ph',  hours: [0, 0, 0, 0, 0] },
    ],
    capacity: 40,
  };

  // Graph edges for Canvas view
  const graph = (() => {
    const nodes = [];
    const edges = [];
    nodes.push({ id: 'rsg', label: 'Ricardo Soria Galvarro', type: 'me', x: 0, y: 0 });
    projects.forEach((p, i) => {
      const ang = (i / projects.length) * Math.PI * 2;
      nodes.push({ id: p.id, label: p.name, type: 'project', x: Math.cos(ang) * 240, y: Math.sin(ang) * 240 });
      edges.push({ from: 'rsg', to: p.id });
    });
    Object.entries(products).forEach(([projId, prods]) => {
      const proj = nodes.find(n => n.id === projId);
      if (!proj) return;
      prods.forEach((prod, j) => {
        const ang = (j / prods.length) * Math.PI * 2;
        const px = proj.x + Math.cos(ang) * 130;
        const py = proj.y + Math.sin(ang) * 130;
        nodes.push({ id: `${projId}-${prod.id}`, label: prod.name, type: 'product', x: px, y: py });
        edges.push({ from: projId, to: `${projId}-${prod.id}` });
      });
    });
    return { nodes, edges };
  })();

  return { users, projects, products, tasks, projectTasks, carga, graph };
})();
