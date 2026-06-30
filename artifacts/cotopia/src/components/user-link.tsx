import { Link } from "wouter";
import { RoleBadges, type UserRole } from "./role-badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface PrimaryBadge {
  id: number;
  name: string;
  icon: string;
  color: string;
  category: string;
}

interface UserLinkProps {
  username: string;
  userId?: number | null;
  role?: UserRole;
  isVerified?: boolean;
  artistId?: number | null;
  className?: string;
  badgeSize?: "sm" | "md" | "lg";
  primaryBadge?: PrimaryBadge | null;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserLink({ username, userId, role, isVerified, artistId, className = "", badgeSize = "sm", primaryBadge, onClick }: UserLinkProps) {
  const href = artistId ? `/artists/${artistId}` : userId ? `/users/${userId}` : null;

  const badgeChip = primaryBadge ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] flex-shrink-0 cursor-default"
          style={{ backgroundColor: `${primaryBadge.color}20`, color: primaryBadge.color }}
        >
          {primaryBadge.icon}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{primaryBadge.name}</TooltipContent>
    </Tooltip>
  ) : null;

  const content = (
    <>
      {username}
      <RoleBadges role={role} size={badgeSize} isVerified={isVerified} />
      {badgeChip}
    </>
  );

  if (!href) {
    return <span className={`inline-flex items-center gap-0.5 ${className}`}>{content}</span>;
  }

  return (
    <Link
      href={href}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <span className={`inline-flex items-center gap-0.5 hover:text-primary transition-colors cursor-pointer ${className}`}>
        {content}
      </span>
    </Link>
  );
}
