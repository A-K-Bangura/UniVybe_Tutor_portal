import { useEffect } from "react";
import { useAppearance } from "../lib/appearance";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle() {
  const { theme, toggle } = useAppearance();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <button
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
      title="Appearance"
      onClick={toggle}
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
