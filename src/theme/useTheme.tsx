import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const storageKey = "notion-dashboard-theme";

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    return stored || "dark";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (t: Theme) => {
      const prefersDark = mediaQuery.matches;
      const resolved = t === "system" ? (prefersDark ? "dark" : "light") : t;
      const root = document.documentElement;
      root.classList.toggle("theme-dark", resolved === "dark");
      root.classList.toggle("theme-light", resolved === "light");
    };
    apply(theme);
    localStorage.setItem(storageKey, theme);
    const onChange = () => {
      if (theme === "system") apply("system");
    };
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
