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
  isVerified?: boolean;
  verificationType?: string | null;
}

export function VerifiedBadge({ role, size = "sm", isVerified, verificationType }: RoleBadgesProps) {
  const isStaff = role === "master_admin" || role === "admin" || role === "editor" || role === "moderator";
  if (!isVerified && !isStaff) return null;

  const iconSize =
    size === "lg" ? "w-6 h-6" : size === "md" ? "w-4 h-4" : "w-3 h-3";

  // Staff badges take precedence and reflect the staff role.
  if (role === "master_admin" || role === "admin") {
    return <BadgeCheck className={`${iconSize} text-red-500 flex-shrink-0`} aria-label="Verified staff" />;
  }
  if (role === "editor") {
    return <BadgeCheck className={`${iconSize} text-blue-500 flex-shrink-0`} aria-label="Verified editor" />;
  }
  if (role === "moderator") {
    return <BadgeCheck className={`${iconSize} text-violet-400 flex-shrink-0`} aria-label="Verified moderator" />;
  }

  // Verified members: distinguish artist vs label using the admin-granted verificationType,
  // falling back to the account role for older records.
  const verifiedAs = verificationType ?? (role === "artist" || role === "label" ? role : null);
  if (verifiedAs === "artist") {
    return <BadgeCheck className={`${iconSize} text-yellow-400 flex-shrink-0`} aria-label="Verified Artist" />;
  }
  if (verifiedAs === "label") {
    return <BadgeCheck className={`${iconSize} text-sky-400 flex-shrink-0`} aria-label="Verified Label" />;
  }
  return <BadgeCheck className={`${iconSize} text-emerald-400 flex-shrink-0`} aria-label="Verified" />;
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
  if (role === "business") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-400/30 flex-shrink-0`}>
        Business
      </span>
    );
  }
  if (role === "listener") {
    return (
      <span className={`${textSize} ${px} rounded font-bold uppercase tracking-wider bg-teal-500/15 text-teal-400 border border-teal-400/30 flex-shrink-0`}>
        Creator
      </span>
    );
  }
  return null;
}

export function RoleBadges({ role, size = "sm", isVerified, verificationType }: RoleBadgesProps) {
  const verified = <VerifiedBadge role={role} size={size} isVerified={isVerified} verificationType={verificationType} />;
  const tag = <RoleTag role={role} size={size} />;
  if (!verified && !tag) return null;
  return (
    <>
      {verified}
      {tag}
    </>
  );
}
