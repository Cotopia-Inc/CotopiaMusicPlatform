import { BadgeCheck } from "lucide-react";

export type UserRole =
  | "master_admin"
  | "admin"
  | "editor"
  | "moderator"
  | "artist"
  | "label"
  | "listener"
  | string
  | null
  | undefined;

interface RoleBadgesProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
}

export function VerifiedBadge({ role, size = "sm" }: RoleBadgesProps) {
  const iconSize =
    size === "lg" ? "w-6 h-6" : size === "md" ? "w-4 h-4" : "w-3 h-3";

  if (role === "master_admin" || role === "admin") {
    return <BadgeCheck className={`${iconSize} text-red-500 flex-shrink-0`} />;
  }
  if (role === "editor") {
    return <BadgeCheck className={`${iconSize} text-blue-500 flex-shrink-0`} />;
  }
  if (role === "artist") {
    return <BadgeCheck className={`${iconSize} text-purple-400 flex-shrink-0`} />;
  }
  if (role === "label") {
    return <BadgeCheck className={`${iconSize} text-sky-400 flex-shrink-0`} />;
  }
  return null;
}

export function RoleTag({ role, size = "sm" }: RoleBadgesProps) {
  const textSize = size === "lg" ? "text-[11px]" : "text-[9px]";
  const px = size === "lg" ? "px-1.5 py-0.5" : "px-1 py-px";

  if (role === "master_admin") {
    return (
      <span className={`${textSize} ${px} font-bold text-amber-400 tracking-wide flex-shrink-0`}>
        ★★★
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className={`${textSize} ${px} font-bold text-amber-400 tracking-wide flex-shrink-0`}>
        ★
      </span>
    );
  }
  if (role === "editor") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-amber-400/15 text-amber-400 border border-amber-400/30 flex-shrink-0`}>
        Editor
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-400/30 flex-shrink-0`}>
        Mod
      </span>
    );
  }
  if (role === "artist") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-400/30 flex-shrink-0`}>
        Artist
      </span>
    );
  }
  if (role === "label") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-400/30 flex-shrink-0`}>
        Label
      </span>
    );
  }
  return null;
}

export function RoleBadges({ role, size = "sm" }: RoleBadgesProps) {
  const verified = <VerifiedBadge role={role} size={size} />;
  const tag = <RoleTag role={role} size={size} />;
  if (!verified && !tag) return null;
  return (
    <>
      {verified}
      {tag}
    </>
  );
}
