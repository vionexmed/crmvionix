import { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="vx-empty-state" role="status">
      {/* Anel com ícone */}
      <div className="vx-empty-icon-ring">
        <span className="[&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-primary">{icon}</span>
      </div>

      {/* Decoração SVG sutil */}
      <svg
        aria-hidden
        className="absolute opacity-[0.04] pointer-events-none"
        width="200" height="200"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="80" stroke="hsl(187 100% 27%)" strokeWidth="1.5" strokeDasharray="6 4" />
        <circle cx="100" cy="100" r="55" stroke="hsl(187 100% 27%)" strokeWidth="1" strokeDasharray="3 6" />
      </svg>

      <h3 className="relative text-base font-semibold text-foreground">{title}</h3>
      <p className="relative mt-1.5 max-w-[280px] text-sm text-muted-foreground leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <Button className="relative mt-5" onClick={onAction} aria-label={actionLabel}>
          <Plus className="mr-1.5 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
