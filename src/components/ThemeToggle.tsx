import { Moon, Sun, Monitor } from "lucide-react";
import { usePreferences, type ThemeMode } from "@/contexts/PreferencesContext";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export const ThemeToggle = () => {
  const { theme, cycleTheme } = usePreferences();
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Tema: ${theme} (Ctrl+Shift+L)`}
      aria-label={`Alternar tema (atual: ${theme})`}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};
