import { useParams, Link, useLocation } from "wouter";
import { LinkifiedText } from "@/components/linkified-text";
import { displayRole } from "@/lib/display-role";
import { useRef, useState } from "react";
import { useGetPublicUser, useFollowUser, useUnfollowUser, useGetCreatorSupportStatus } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CalendarDays, Music, MessageCircle, Volume2, VolumeX, Ban, UserPlus, UserCheck, Settings, LayoutDashboard, Users, Heart, Instagram, Twitter, Linkedin, ExternalLink } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/lib/auth";
import { ReportModal } from "@/components/report-modal";
import { useToast } from "@/hooks/use-toast";
import { BadgeList, type UserBadgeData } from "@/components/badge-chip";
import { useSeo } from "@/hooks/use-seo";
import { EventsTab } from "@/components/events-tab";
import { SupportButton } from "@/components/support-modal";
import { SupportWall } from "@/components/support-wall";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useGetPublicUser(Number(id));
  const { user: me } = useAuth();

  useSeo({
    title: user ? (user.displayName || user.username) : "Profile",
    description: user
      ? (user as any)?.bio?.trim() || `View ${user.displayName || user.username}'s profile on Everyday Radio by Cotopia.`
      : undefined,
    type: "profile",
    noindex: !user,
  });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0);

  const { data: userBadges } = useQuery<UserBadgeData[]>({
    queryKey: ["user-badges", Number(id)],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/${id}/badges`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const targetId = Number(id);
  const { data: blockedIds } = useQuery({
    queryKey: ["user-blocks"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/blocks`, { headers: authHeaders() });
      if (!res.ok) return [] as number[];
      return res.json() as Promise<number[]>;
    },
    enabled: !!me,
  });
  const isBlocked = !!blockedIds?.includes(targetId);

  const blockMutation = useMutation({
    mutationFn: async (block: boolean) => {
      if (block) {
        await fetch(`${import.meta.env.BASE_URL}api/users/block`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ userId: targetId }) });
      } else {
        await fetch(`${import.meta.env.BASE_URL}api/users/block/${targetId}`, { method: "DELETE", headers: authHeaders() });
      }
    },
    onSuccess: (_d, block) => {
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
      toast({ title: block ? "User blocked" : "User unblocked" });
    },
    onError: () => toast({ variant: "destructive", title: "Action failed", description: "Please try again." }),
  });

  // Follow / unfollow
  const [optimisticFollowed, setOptimisticFollowed] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const followMutation = useFollowUser({
    mutation: {
      onMutate: () => {
        setOptimisticFollowed(true);
        setOptimisticCount(c => (c ?? (user?.followerCount ?? 0)) + 1);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getPublicUser", targetId] }),
      onError: () => { setOptimisticFollowed(null); setOptimisticCount(null); toast({ variant: "destructive", title: "Could not follow" }); },
    },
  });
  const unfollowMutation = useUnfollowUser({
    mutation: {
      onMutate: () => {
        setOptimisticFollowed(false);
        setOptimisticCount(c => Math.max(0, (c ?? (user?.followerCount ?? 0)) - 1));
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getPublicUser", targetId] }),
      onError: () => { setOptimisticFollowed(null); setOptimisticCount(null); toast({ variant: "destructive", title: "Could not unfollow" }); },
    },
  });
  const isFollowed = optimisticFollowed ?? user?.isFollowed ?? false;
  const followerCount = optimisticCount ?? user?.followerCount ?? 0;

  const { data: profileSupportStatus } = useGetCreatorSupportStatus(targetId, undefined, {
    query: { enabled: !!targetId, queryKey: ["getCreatorSupportStatus", targetId] },
  });


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

  const isMe = me?.id === user.id;
  const isStaff = ["admin", "master_admin", "moderator", "editor"].includes(user.role ?? "");

  return (
    <div className="space-y-0 pb-24">
      {/* Back */}
      <div className="px-2 pt-2">
        <Link href={history.length > 1 ? "#" : "/"} onClick={() => window.history.back()}>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back
          </span>
        </Link>
      </div>

      {/* Banner / Profile Video */}
      <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden bg-secondary border border-border relative mt-2">
        {(user as any).profileVideoUrl ? (
          <video
            ref={(el) => { videoRef.current = el; if (el) { el.volume = volume; el.muted = volume === 0; } }}
            style={{ pointerEvents: 'none' }}
            src={(user as any).profileVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (user as any).bannerUrl ? (
          <img src={(user as any).bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        {(user as any).profileVideoUrl && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 bg-black/50 hover:bg-black/70 rounded-full px-3 py-1.5 transition-colors">
            <button onClick={() => setVolume(v => v === 0 ? 0.8 : 0)} className="text-white flex-shrink-0" title={volume === 0 ? "Unmute" : "Mute"}>
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <div className="w-24" style={{ pointerEvents: 'auto' }}>
              <Slider value={[Math.round(volume * 100)]} max={100} step={1} onValueChange={([v]) => setVolume(v / 100)} />
            </div>
          </div>
        )}
      </div>

      {/* Avatar + info */}
      <div className="flex flex-col md:flex-row gap-6 px-6 -mt-14 relative z-10 items-end">
        <div className="w-28 h-28 rounded-full bg-card border-4 border-background shadow-2xl overflow-hidden flex items-center justify-center flex-shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-muted-foreground">{user.username[0].toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
              {user.displayName || user.username}
              <RoleBadges role={user.role} isVerified={user.isVerified} verificationType={(user as any).verificationType} size="md" />
            </h1>
            {user.displayName && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{displayRole(user.role)}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {user.role === "artist" && user.artistId && (
              <Link href={`/artists/${user.artistId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Music className="w-4 h-4" />
                  Artist Profile
                </Button>
              </Link>
            )}

            {/* Own-profile shortcuts */}
            {isMe && (
              <>
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings className="w-4 h-4" />
                    Edit Profile
                  </Button>
                </Link>
                {(user.role === "editor") && (
                  <Link href="/editor">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <LayoutDashboard className="w-4 h-4" />
                      Editor Dashboard
                    </Button>
                  </Link>
                )}
                {(user.role === "moderator") && (
                  <Link href="/moderator">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <LayoutDashboard className="w-4 h-4" />
                      Mod Dashboard
                    </Button>
                  </Link>
                )}
                {(user.role === "master_admin") && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <LayoutDashboard className="w-4 h-4" />
                      Admin Dashboard
                    </Button>
                  </Link>
                )}
              </>
            )}

            {/* Follow — visible to any logged-in user including yourself */}
            {me && (
              <Button
                size="sm"
                variant={isFollowed ? "secondary" : "default"}
                className="gap-1.5"
                disabled={followMutation.isPending || unfollowMutation.isPending}
                onClick={() => isFollowed
                  ? unfollowMutation.mutate({ id: targetId })
                  : followMutation.mutate({ id: targetId })
                }
              >
                {isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isFollowed ? "Following" : "Follow"}
              </Button>
            )}

            {/* Actions only relevant when viewing someone else */}
            {me && !isMe && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/messages?new=${user.id}`)}>
                  <MessageCircle className="w-4 h-4" />
                  Message
                </Button>
                <SupportButton
                  creatorUserId={user.id}
                  creatorName={user.displayName || user.username}
                  contentType="creator"
                  contentId={user.id}
                  size="sm"
                />
                {!isStaff && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={blockMutation.isPending}
                    onClick={() => blockMutation.mutate(!isBlocked)}
                  >
                    <Ban className="w-4 h-4" />
                    {isBlocked ? "Unblock" : "Block"}
                  </Button>
                )}
                <ReportModal targetType="profile" targetId={user.id} variant="button" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bio + meta */}
      <div className="px-6 pt-6 space-y-3 max-w-2xl">
        {user.bio && (
          <p className="text-sm text-muted-foreground leading-relaxed"><LinkifiedText text={user.bio} /></p>
        )}
        {/* Social links */}
        {(user.instagramUrl || user.xUrl || user.tiktokUrl || user.linkedinUrl || user.pinterestUrl) && (
          <div className="flex items-center gap-3 flex-wrap">
            {user.instagramUrl && (
              <a href={user.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-pink-400 transition-colors" title="Instagram">
                <Instagram className="w-4 h-4" />
                <span className="hidden sm:inline">Instagram</span>
              </a>
            )}
            {user.xUrl && (
              <a href={user.xUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="X / Twitter">
                <Twitter className="w-4 h-4" />
                <span className="hidden sm:inline">X</span>
              </a>
            )}
            {user.tiktokUrl && (
              <a href={user.tiktokUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="TikTok">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">TikTok</span>
              </a>
            )}
            {user.linkedinUrl && (
              <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors" title="LinkedIn">
                <Linkedin className="w-4 h-4" />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>
            )}
            {user.pinterestUrl && (
              <a href={user.pinterestUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors" title="Pinterest">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pinterest</span>
              </a>
            )}
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold text-foreground">{followerCount.toLocaleString()}</span>
            {followerCount === 1 ? "follower" : "followers"}
          </div>
          {profileSupportStatus?.supportEnabled && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart className="w-3.5 h-3.5" />
              <span className="font-semibold text-foreground">{(profileSupportStatus.supporterCount ?? 0).toLocaleString()}</span>
              {(profileSupportStatus.supporterCount ?? 0) === 1 ? "supporter" : "supporters"}
            </div>
          )}
          {user.createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>

      {/* Featured Badges */}
      {userBadges && userBadges.filter(ub => ub.isFeatured && ub.badge.isActive && ub.badge.isVisible).length > 0 && (
        <div className="px-6 pt-5 max-w-2xl space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Featured Badges</p>
          <BadgeList
            userBadges={[...userBadges.filter(ub => ub.isFeatured && ub.badge.isActive && ub.badge.isVisible)].sort((a, b) => (a.featureOrder ?? 99) - (b.featureOrder ?? 99))}
            size="md"
          />
        </div>
      )}

      {/* All Badges */}
      {userBadges && userBadges.filter(ub => !ub.isFeatured && ub.badge.isActive && ub.badge.isVisible).length > 0 && (
        <div className="px-6 pt-4 max-w-2xl space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
            {userBadges.some(ub => ub.isFeatured) ? "Other Badges" : "Badges"}
          </p>
          <BadgeList userBadges={userBadges.filter(ub => !ub.isFeatured && ub.badge.isActive && ub.badge.isVisible)} size="sm" />
        </div>
      )}

      {/* Events */}
      <div className="px-6 pt-8 max-w-2xl">
        <EventsTab userId={user.id} isOwner={isMe} heading="Events" />
      </div>

      {/* Community Support */}
      <div className="px-6 pt-8 max-w-2xl">
        <SupportWall userId={user.id} />
      </div>
    </div>
  );
}
