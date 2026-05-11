/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ---------- Icons (line glyphs, no emoji) ----------
const Icon = ({ name, size = 16 }) => {
  const s = size, stroke = 1.6;
  const paths = {
    search: <><circle cx="7.5" cy="7.5" r="4.5"/><path d="m11 11 3 3"/></>,
    home: <><path d="M3 9 9 4l6 5v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z"/><path d="M7 16v-4h4v4"/></>,
    panel: <><rect x="2.5" y="2.5" width="13" height="13" rx="1.5"/><path d="M2.5 6.5h13M6.5 6.5v9"/></>,
    graph: <><circle cx="9" cy="9" r="2"/><circle cx="3" cy="3" r="1.5"/><circle cx="15" cy="3" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/><path d="M7.5 7.5 4 4M10.5 7.5 14 4M7.5 10.5 4 14M10.5 10.5 14 14"/></>,
    chart: <><path d="M3 14V9M7.5 14V5M12 14v-3M3 16h12.5"/></>,
    folder: <><path d="M2.5 5a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5Z"/></>,
    file: <><path d="M4 2.5h6L13.5 6v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Z"/><path d="M10 2.5V6h3.5"/></>,
    caret: <path d="m6 4 4 4-4 4"/>,
    plus: <><path d="M9 4v10M4 9h10"/></>,
    sun: <><circle cx="9" cy="9" r="3"/><path d="M9 1.5V3M9 15v1.5M3.5 3.5l1 1M13.5 13.5l1 1M1.5 9H3M15 9h1.5M3.5 14.5l1-1M13.5 4.5l1-1"/></>,
    moon: <path d="M14.5 10.5a6 6 0 0 1-8-8 6 6 0 1 0 8 8Z"/>,
    monitor: <><rect x="2" y="3" width="14" height="10" rx="1.5"/><path d="M6 16h6M9 13v3"/></>,
    logout: <><path d="M11 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M7 9h9m0 0-2.5-2.5M16 9l-2.5 2.5"/></>,
    notion: <><rect x="2.5" y="2.5" width="13" height="13" rx="1.5"/><path d="M5 5v8M5 5l6 8V5"/></>,
    download: <><path d="M9 3v8M9 11l3-3M9 11 6 8M3 14h12"/></>,
    refresh: <><path d="M3 5a6 6 0 0 1 11 1M15 13a6 6 0 0 1-11-1"/><path d="M14 2v4h-4M4 16v-4h4"/></>,
    expand: <><path d="M3 6.5V3h3.5M15 11.5V15h-3.5M11.5 3H15v3.5M3 11.5V15h3.5"/></>,
    close: <path d="m4 4 10 10M14 4 4 14"/>,
    cmd: <><path d="M5 5h8v8H5z"/><path d="M5 5V3.5a1.5 1.5 0 1 1 1.5 1.5H5Zm0 8v1.5a1.5 1.5 0 1 1-1.5-1.5H5Zm8-8V3.5a1.5 1.5 0 1 0 1.5 1.5H13Zm0 8v1.5a1.5 1.5 0 1 0 1.5-1.5H13Z"/></>,
    arrow: <path d="M4 9h10m0 0-3.5-3.5M14 9l-3.5 3.5"/>,
    star: <path d="M9 2.5l2 4 4.4.7-3.2 3.1.7 4.4L9 12.6 5.1 14.7l.7-4.4-3.2-3.1L7 6.5l2-4Z"/>,
    flag: <><path d="M4 2v14M4 3h9l-2 3 2 3H4"/></>,
    settings: <><circle cx="9" cy="9" r="2"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.5 1.5M12.5 12.5 14 14M4 14l1.5-1.5M12.5 5.5 14 4"/></>,
    sidebar: <><rect x="2.5" y="3" width="13" height="12" rx="1.5"/><path d="M7 3v12"/></>,
    bell: <><path d="M5 12a4 4 0 0 1 8 0v2H5v-2ZM7.5 14v.5a1.5 1.5 0 0 0 3 0V14"/><path d="M9 4V2.5"/></>,
    layers: <><path d="M9 2 2.5 5.5 9 9l6.5-3.5L9 2Z"/><path d="M2.5 9.5 9 13l6.5-3.5M2.5 12.5 9 16l6.5-3.5"/></>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
  );
};

// ---------- Status helpers ----------
const STATUS = {
  'listo':       { label: 'Listo',       cls: 'success' },
  'en-curso':    { label: 'En curso',    cls: 'info' },
  'sin-empezar': { label: 'Sin empezar', cls: '' },
  'bloqueada':   { label: 'Bloqueada',   cls: 'warn' },
};

const Pill = ({ kind = '', children, dot = true }) => (
  <span className={`pill${kind ? ' ' + kind : ''}`}>
    {dot && <span className="dot"/>}
    {children}
  </span>
);

const StatusPill = ({ status }) => {
  const s = STATUS[status] || STATUS['sin-empezar'];
  return <Pill kind={s.cls}>{s.label}</Pill>;
};

const Avatar = ({ user, size = 22 }) => {
  if (!user) return <span className="avatar" style={{ width: size, height: size, opacity: 0.5 }}>?</span>;
  const colors = ['color-1','color-2','color-3','color-4','color-5'];
  const c = colors[user.id.charCodeAt(0) % 5];
  return <span className={`avatar ${c}`} style={{ width: size, height: size, fontSize: size*0.4 }}>{user.initials}</span>;
};

const Bar = ({ value, kind = '' }) => (
  <div className={`bar${kind ? ' ' + kind : ''}`}><i style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}/></div>
);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}`;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const TODAY = '2026-05-11';

Object.assign(window, { Icon, Pill, StatusPill, Avatar, Bar, fmtDate, fmtDateShort, daysBetween, STATUS, TODAY });
