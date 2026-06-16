import { useParams, Link, useLocation } from "wouter";
import { useRef, useState, useEffect } from "react";
import { useGetPublicUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CalendarDays, Music, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/lib/auth";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading } = useGetPublicUser(Number(id));
  const { user: me } = useAuth();
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0);


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
              <RoleBadges role={user.role} isVerified={user.isVerified} size="md" />
            </h1>
            {user.displayName && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{user.role?.replace("_", " ")}</p>
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
            {me && !isMe && (
              <Button size="sm" className="gap-1.5" onClick={() => navigate(`/messages?new=${user.id}`)}>
                <MessageCircle className="w-4 h-4" />
                Message
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bio + meta */}
      {(user.bio || user.createdAt) && (
        <div className="px-6 pt-6 space-y-2 max-w-2xl">
          {user.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
          </div>
        </div>
      )}
    </div>
  );
}
