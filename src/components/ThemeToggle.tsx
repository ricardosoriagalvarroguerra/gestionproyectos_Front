import { Theme, useTheme } from "../theme/useTheme";

const options: { label: string; value: Theme; icon: JSX.Element }[] = [
  {
    label: "Sistema",
    value: "system",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
        <path d="M8 19.5h8" />
        <path d="M12 16.5v3" />
      </svg>
    ),
  },
  {
    label: "Claro",
    value: "light",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" />
      </svg>
    ),
  },
  {
    label: "Oscuro",
    value: "dark",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 15.2A7.9 7.9 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="ui-segmented" role="group" aria-label="Tema">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`ui-segment flex items-center justify-center gap-2 ${theme === opt.value ? "is-active" : ""}`}
          aria-label={opt.label}
          aria-pressed={theme === opt.value}
          title={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
