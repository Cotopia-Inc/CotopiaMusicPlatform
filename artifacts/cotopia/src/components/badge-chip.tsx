import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

export interface BadgeData {
  id: number;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  isVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserBadgeData {
  id: number;
  userId: number;
  username?: string;
  displayName?: string | null;
  badgeId: number;
  awardedByAdminId?: number | null;
  awardedByUsername?: string | null;
  isFeatured?: boolean;
  featureOrder?: number | null;
  awardedAt: string;
  reason?: string | null;
  badge: BadgeData;
}

const CATEGORY_PRIORITY: Record<string, number> = {
  admin: 0,
  beta: 1,
  creator: 2,
  community: 3,
  achievement: 4,
};

export function getPrimaryBadge(userBadges: UserBadgeData[]): UserBadgeData | null {
  if (!userBadges || userBadges.length === 0) return null;
  const active = userBadges.filter(ub => ub.badge.isActive && ub.badge.isVisible);
  if (active.length === 0) return null;
  return active.sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.badge.category] ?? 99;
    const pb = CATEGORY_PRIORITY[b.badge.category] ?? 99;
    return pa - pb;
  })[0];
}

interface BadgeChipProps {
  badge: BadgeData;
  awardedAt?: string;
  reason?: string | null;
  size?: "xs" | "sm" | "md";
  showTooltip?: boolean;
}

export function BadgeChip({ badge, awardedAt, reason, size = "sm", showTooltip = true }: BadgeChipProps) {
  const textSize = size === "md" ? "text-xs" : size === "sm" ? "text-[10px]" : "text-[9px]";
  const iconSize = size === "md" ? "text-sm" : size === "sm" ? "text-xs" : "text-[10px]";
  const px = size === "md" ? "px-2 py-1" : size === "sm" ? "px-1.5 py-0.5" : "px-1 py-px";

  const chip = (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border font-semibold flex-shrink-0 ${px} ${textSize}`}
      style={{
        borderColor: `${badge.color}40`,
        backgroundColor: `${badge.color}15`,
        color: badge.color,
      }}
    >
      <span className={iconSize}>{badge.icon}</span>
      {size !== "xs" && <span>{badge.name}</span>}
    </span>
  );

  if (!showTooltip) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {chip}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center space-y-1">
        <p className="font-bold">{badge.icon} {badge.name}</p>
        <p className="text-xs text-muted-foreground">{badge.description}</p>
        {awardedAt && (
          <p className="text-[10px] text-muted-foreground/70">
            Earned {formatDistanceToNow(new Date(awardedAt), { addSuffix: true })}
          </p>
        )}
        {reason && (
          <p className="text-[10px] text-muted-foreground/70 italic">{reason}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface BadgeListProps {
  userBadges: UserBadgeData[];
  size?: "xs" | "sm" | "md";
}

export function BadgeList({ userBadges, size = "sm" }: BadgeListProps) {
  const active = userBadges.filter(ub => ub.badge.isActive && ub.badge.isVisible);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((ub) => (
        <BadgeChip
          key={ub.id}
          badge={ub.badge}
          awardedAt={ub.awardedAt}
          reason={ub.reason}
          size={size}
          showTooltip
        />
      ))}
    </div>
  );
}
