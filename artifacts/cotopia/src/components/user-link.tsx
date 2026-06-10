import { Link } from "wouter";
import { RoleBadges, type UserRole } from "./role-badges";

interface UserLinkProps {
  username: string;
  userId?: number | null;
  role?: UserRole;
  isVerified?: boolean;
  artistId?: number | null;
  className?: string;
  badgeSize?: "sm" | "md" | "lg";
  onClick?: (e: React.MouseEvent) => void;
}

export function UserLink({ username, userId, role, isVerified, artistId, className = "", badgeSize = "sm", onClick }: UserLinkProps) {
  const href = artistId ? `/artists/${artistId}` : userId ? `/users/${userId}` : null;

  const content = (
    <>
      {username}
      <RoleBadges role={role} size={badgeSize} isVerified={isVerified} />
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
