import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Pattern = "dots" | "grid" | "rings" | "diagonal" | "waves" | "sparkle" | "ticks";

interface PageHeaderProps {
  icon: LucideIcon;
  kicker?: string;
  title: string;
  description?: string;
  pattern?: Pattern;
  actions?: ReactNode;
  meta?: ReactNode;
}

const patternStyles: Record<Pattern, React.CSSProperties> = {
  dots: {
    backgroundImage:
      "radial-gradient(hsl(var(--foreground) / 0.18) 1px, transparent 1px)",
    backgroundSize: "10px 10px",
  },
  grid: {
    backgroundImage:
      "linear-gradient(hsl(var(--foreground) / 0.10) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.10) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
  },
  rings: {
    backgroundImage:
      "repeating-radial-gradient(circle at 0 50%, transparent 0, transparent 14px, hsl(var(--foreground) / 0.10) 14px, hsl(var(--foreground) / 0.10) 15px)",
  },
  diagonal: {
    backgroundImage:
      "repeating-linear-gradient(45deg, hsl(var(--foreground) / 0.08) 0 1px, transparent 1px 8px)",
  },
  waves: {
    backgroundImage:
      "radial-gradient(circle at 10px 10px, hsl(var(--foreground) / 0.10) 2px, transparent 2px), radial-gradient(circle at 0 0, hsl(var(--foreground) / 0.10) 2px, transparent 2px)",
    backgroundSize: "20px 20px",
  },
  sparkle: {
    backgroundImage:
      "radial-gradient(hsl(var(--primary) / 0.25) 1px, transparent 1.5px), radial-gradient(hsl(var(--foreground) / 0.10) 1px, transparent 1.5px)",
    backgroundSize: "24px 24px, 12px 12px",
    backgroundPosition: "0 0, 6px 6px",
  },
  ticks: {
    backgroundImage:
      "repeating-linear-gradient(90deg, hsl(var(--foreground) / 0.12) 0 1px, transparent 1px 12px)",
  },
};

export function PageHeader({
  icon: Icon,
  kicker,
  title,
  description,
  pattern = "dots",
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      {/* Decorative pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]"
        style={patternStyles[pattern]}
      />
      {/* Accent edge */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-primary/40 to-transparent"
      />

      <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            {kicker && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {kicker}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                {description}
              </p>
            )}
            {meta && <div className="mt-2">{meta}</div>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
