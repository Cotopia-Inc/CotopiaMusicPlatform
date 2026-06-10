import { Link } from "wouter";
import { RoleBadges, type UserRole } from "./role-badges";

interface UserLinkProps {
  username: string;
  role?: UserRole;
  artistId?: number | null;
  isVerified?: boolean;
  className?: string;
  badgeSize?: "sm" | "md" | "lg";
  onClick?: (e: React.MouseEvent) => void;
}

export function UserLink({ username, role, artistId, className = "", badgeSize = "sm", onClick }: UserLinkProps) {
  const inner = (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {username}
      <RoleBadges role={role} size={badgeSize} />
    </span>
  );

  if (!artistId) return inner;

  return (
    <Link
      href={`/artists/${artistId}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <span className={`inline-flex items-center gap-0.5 hover:text-primary transition-colors ${className}`}>
        {username}
        <RoleBadges role={role} size={badgeSize} />
      </span>
    </Link>
  );
}
