import { useParams, Link } from "wouter";
import { useGetPublicUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadges } from "@/components/role-badges";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CalendarDays, Music } from "lucide-react";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useGetPublicUser(Number(id));

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 space-y-6">
        <Skeleton className="h-24 w-24 rounded-full mx-auto" />
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center">
        <p className="text-muted-foreground">User not found.</p>
        <Link href="/">
          <span className="text-primary text-sm hover:underline mt-4 inline-block">← Back home</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-6 space-y-8">
      <Link href={history.length > 1 ? "#" : "/"} onClick={() => window.history.back()}>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </span>
      </Link>

      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">{user.username[0].toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center justify-center gap-1.5 flex-wrap">
            {user.displayName || user.username}
            <RoleBadges role={user.role} size="md" />
          </h1>
          {user.displayName && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{user.role?.replace("_", " ")}</p>
        </div>

        {user.bio && (
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{user.bio}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
        </div>

        {user.artistId && (
          <Link href={`/artists/${user.artistId}`}>
            <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer font-medium">
              <Music className="w-4 h-4" />
              View Artist Profile
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
