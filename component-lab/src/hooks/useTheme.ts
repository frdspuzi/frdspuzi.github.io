import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

// Ported from floating_toc.html's setTheme()/theme-toggle logic. The pre-paint sync (avoiding a
// flash of the wrong theme on load) lives in index.html's own inline script, same split as the
// original site (header.html did the pre-paint sync, floating_toc.html owned the actual toggle).
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" ? "dark" : "light";
  });

  const setTheme = useCallback((next: Theme) => {
    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        // localStorage can throw in some privacy modes — theme still applies for this load,
        // just doesn't persist. Same silent fallback as the original site's own try/catch.
      }
      setThemeState(next);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Keeps state in sync if data-theme is ever changed outside this hook (e.g. index.html's own
  // pre-paint script already applied a stored preference before React mounted).
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") setThemeState(attr);
  }, []);

  return { theme, setTheme, toggle };
}
