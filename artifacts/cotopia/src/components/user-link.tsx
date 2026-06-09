import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";

interface UserLinkProps {
  username: string;
  artistId?: number | null;
  isVerified?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserLink({ username, artistId, isVerified, className = "", onClick }: UserLinkProps) {
  const inner = (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {username}
      {isVerified && <BadgeCheck className="w-3 h-3 text-green-500 flex-shrink-0" />}
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
        {isVerified && <BadgeCheck className="w-3 h-3 text-green-500 flex-shrink-0" />}
      </span>
    </Link>
  );
}
