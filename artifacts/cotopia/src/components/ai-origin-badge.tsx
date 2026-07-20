/**
 * AI / Human origin badge.
 *
 * Renders as a CSS overlay over cover art or as an inline title label.
 * NEVER modifies the original uploaded artwork — the badge is purely
 * a platform-controlled CSS element that can be shown, hidden, or changed
 * without touching the creator's original file.
 */
import { cn } from "@/lib/utils";

export type CreationMethod =
  | "unclassified"
  | "human_created"
  | "ai_assisted"
  | "hybrid_human_ai"
  | "fully_ai_generated"
  | "disputed"
  | "under_review";

interface AiOriginBadgeProps {
  method: CreationMethod;
  /** "cover" = small overlay on artwork; "title" = inline icon+label beside title */
  variant?: "cover" | "title";
  className?: string;
  // Per-method visibility toggles driven by global settings
  showHumanBadge?: boolean;
  showAiBadge?: boolean;
  showHybridBadge?: boolean;
  showFullyAiBadge?: boolean;
  showTitleIcons?: boolean;
  showCoverOverlays?: boolean;
}

interface BadgeConfig {
  label: string;
  shortLabel: string;
  icon: string;
  ariaLabel: string;
  coverClass: string;
  titleClass: string;
}

const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  human_created: {
    label: "Human Created",
    shortLabel: "Human",
    icon: "✦",
    ariaLabel: "Creator identified this content as human-created",
    coverClass: "bg-emerald-600/90 text-white",
    titleClass: "text-emerald-600 dark:text-emerald-400",
  },
  ai_assisted: {
    label: "AI Assisted",
    shortLabel: "AI Assisted",
    icon: "◈",
    ariaLabel: "Creator disclosed AI-assisted creation",
    coverClass: "bg-blue-600/90 text-white",
    titleClass: "text-blue-600 dark:text-blue-400",
  },
  hybrid_human_ai: {
    label: "Hybrid",
    shortLabel: "Hybrid",
    icon: "◈",
    ariaLabel: "Creator disclosed hybrid human and AI authorship",
    coverClass: "bg-violet-600/90 text-white",
    titleClass: "text-violet-600 dark:text-violet-400",
  },
  fully_ai_generated: {
    label: "Fully AI",
    shortLabel: "AI",
    icon: "◈",
    ariaLabel: "This content is classified as fully AI-generated",
    coverClass: "bg-red-600/90 text-white",
    titleClass: "text-red-600 dark:text-red-400",
  },
  disputed: {
    label: "Disputed",
    shortLabel: "Disputed",
    icon: "◯",
    ariaLabel: "The origin classification of this content is disputed",
    coverClass: "bg-amber-600/90 text-white",
    titleClass: "text-amber-600 dark:text-amber-400",
  },
  under_review: {
    label: "Under Review",
    shortLabel: "Review",
    icon: "◯",
    ariaLabel: "This content is under origin review",
    coverClass: "bg-amber-600/90 text-white",
    titleClass: "text-amber-600 dark:text-amber-400",
  },
};

export function AiOriginBadge({
  method,
  variant = "title",
  className,
  showHumanBadge = true,
  showAiBadge = true,
  showHybridBadge = true,
  showFullyAiBadge = false,
  showTitleIcons = true,
  showCoverOverlays = true,
}: AiOriginBadgeProps) {
  if (!method || method === "unclassified") return null;

  const shouldShow = (() => {
    switch (method) {
      case "human_created": return showHumanBadge;
      case "ai_assisted": return showAiBadge;
      case "hybrid_human_ai": return showHybridBadge;
      case "fully_ai_generated": return showFullyAiBadge;
      case "disputed":
      case "under_review": return true;
      default: return false;
    }
  })();

  if (!shouldShow) return null;
  if (variant === "cover" && !showCoverOverlays) return null;
  if (variant === "title" && !showTitleIcons) return null;

  const config = BADGE_CONFIGS[method];
  if (!config) return null;

  if (variant === "cover") {
    return (
      <span
        role="img"
        aria-label={config.ariaLabel}
        title={config.ariaLabel}
        className={cn(
          "absolute bottom-1.5 left-1.5 z-10 flex items-center gap-0.5",
          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide leading-none select-none",
          "pointer-events-none",
          config.coverClass,
          className,
        )}
      >
        <span aria-hidden="true">{config.icon}</span>
        {config.shortLabel}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={config.ariaLabel}
      title={config.ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
        config.titleClass,
        className,
      )}
    >
      <span aria-hidden="true" className="text-[8px]">{config.icon}</span>
      {config.label}
    </span>
  );
}

/**
 * Wrapper for cover art images that adds the badge as a CSS overlay.
 * Pass the image as children; the badge floats above it.
 */
export function CoverWithAiBadge({
  method,
  children,
  className,
  ...badgeProps
}: {
  method: CreationMethod;
  children: React.ReactNode;
  className?: string;
} & Omit<AiOriginBadgeProps, "method" | "variant">) {
  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      <AiOriginBadge method={method} variant="cover" {...badgeProps} />
    </div>
  );
}
