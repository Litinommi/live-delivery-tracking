import { ConnectionBadge, BadgeVariant } from "./ConnectionBadge";
import { ThemeToggle } from "./ThemeToggle";
import { Theme } from "../hooks/useTheme";

interface HeaderProps {
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  theme: Theme;
  onToggleTheme: () => void;
  subtitle?: string;
}

export function Header({ badgeVariant, badgeLabel, theme, onToggleTheme, subtitle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 h-14 shrink-0 z-20">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-accent-600 flex items-center justify-center shadow-sm shadow-accent-600/30">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <span className="font-semibold tracking-tight text-slate-900 dark:text-white">TRACK</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {subtitle && (
          <span className="hidden sm:block text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>
        )}
        <ConnectionBadge variant={badgeVariant} label={badgeLabel} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
