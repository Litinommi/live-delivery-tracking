export type BadgeVariant = "live" | "connected" | "reconnecting" | "offline";

const VARIANT_STYLES: Record<BadgeVariant, { dot: string; text: string; pulse: boolean }> = {
  live: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", pulse: true },
  connected: { dot: "bg-accent-500", text: "text-accent-700 dark:text-accent-300", pulse: false },
  reconnecting: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", pulse: true },
  offline: { dot: "bg-slate-400 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400", pulse: false },
};

interface ConnectionBadgeProps {
  variant: BadgeVariant;
  label: string;
}

export function ConnectionBadge({ variant, label }: ConnectionBadgeProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {s.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-75 animate-ping`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      <span className={`text-sm font-medium whitespace-nowrap ${s.text}`}>{label}</span>
    </div>
  );
}
