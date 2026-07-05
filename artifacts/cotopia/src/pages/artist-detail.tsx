import { useParams, Link, useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSeo } from "@/hooks/use-seo";
import { useGetArtist, getGetArtistQueryKey, useFollowArtist, useUnfollowArtist, useTrackAnalyticsEvent, useUpdateArtist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Users, Music, MessageCircle, ArrowLeft, Volume2, VolumeX, ShieldCheck, Loader2, UserCog, UserMinus, Search, Edit2, Save, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { RoleBadges } from "@/components/role-badges";
import { BadgeList } from "@/components/badge-chip";
import { useGetUserBadges, getGetUserBadgesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SongMenu } from "@/components/song-menu";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EventsTab } from "@/components/events-tab";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("cotopia_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ADMIN_ROLES = ["admin", "master_admin"];

export default function ArtistDetail() {
  const { id } = useParams();
  const artistId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { play } = usePlayer();
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0);

  const { data: artist, isLoading } = useGetArtist(artistId, {
    query: { enabled: !!artistId, queryKey: getGetArtistQueryKey(artistId) }
  });

  useSeo({
    title: artist ? artist.stageName : "Artist",
    description: artist
      ? (artist as any)?.bio?.trim() || `Discover ${artist.stageName}'s music and videos on Everyday Radio by Cotopia.`
      : undefined,
    image: (artist as any)?.avatarUrl ?? undefined,
    type: "profile",
    noindex: !artist,
    jsonLd: artist
      ? {
          "@context": "https://schema.org",
          "@type": "MusicGroup",
          name: artist.stageName,
          ...((artist as any)?.genre ? { genre: (artist as any).genre } : {}),
        }
      : undefined,
  });

  const artistUserId = (artist as any)?.userId as number | null | undefined;
  const { data: artistBadges } = useGetUserBadges(artistUserId!, {
    query: { enabled: !!artistUserId, queryKey: getGetUserBadgesQueryKey(artistUserId!) }
  });

  const followMutation = useFollowArtist();
  const unfollowMutation = useUnfollowArtist();
  const trackEvent = useTrackAnalyticsEvent();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignResults, setAssignResults] = useState<{ id: number; username: string; displayName: string | null; role: string }[]>([]);
  const [assignSelected, setAssignSelected] = useState<{ id: number; username: string } | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSearching, setAssignSearching] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editStageName, setEditStageName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const updateArtistMutation = useUpdateArtist();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdmin = ADMIN_ROLES.includes((user as any)?.role ?? "");

  const searchUsers = useCallback((q: string) => {
    if (!q.trim()) { setAssignResults([]); return; }
    setAssignSearching(true);
    fetch(`${import.meta.env.BASE_URL}api/admin/user-directory?search=${encodeURIComponent(q)}&limit=8`, { headers: getAuthHeader() })
      .then(r => r.json())
      .then((data: any[]) => setAssignResults(data))
      .catch(() => setAssignResults([]))
      .finally(() => setAssignSearching(false));
  }, []);

  function handleAssignSearchChange(val: string) {
    setAssignSearch(val);
    setAssignSelected(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchUsers(val), 300);
  }

  async function handleAssignConfirm() {
    if (!assignSelected) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/artists/${artistId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ userId: assignSelected.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Assignment failed");
      }
      toast({ title: "Artist profile assigned", description: `Linked to @${assignSelected.username}` });
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(artistId) });
      setAssignOpen(false);
      setAssignSearch("");
      setAssignSelected(null);
      setAssignResults([]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not assign", description: err.message });
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleUnlink() {
    if (!window.confirm(`Unlink this artist profile from its current user? The profile will become unclaimed and can be reassigned later.`)) return;
    setUnlinkLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/artists/${artistId}/assign`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Unlink failed");
      }
      toast({ title: "Artist profile unlinked", description: "The profile is no longer associated with any user account." });
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(artistId) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not unlink", description: err.message });
    } finally {
      setUnlinkLoading(false);
    }
  }

  async function handleClaim() {
    if (!user) return;
    setIsClaiming(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/artists/${artistId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Claim failed");
      }
      toast({ title: "Artist profile claimed!", description: "This profile is now linked to your account." });
      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(artistId) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not claim profile", description: err.message });
    } finally {
      setIsClaiming(false);
    }
  }

  useEffect(() => {
    if (artist?.id) {
      trackEvent.mutate({ data: { eventType: "page_view", eventName: "artist_profile", contentType: "user" as const, contentId: artist.id } });
    }
  }, [artist?.id]);


  const handleFollowToggle = () => {
    if (!artist) return;
    const isFollowing = artist.isFollowed;
    const mutation = isFollowing ? unfollowMutation : followMutation;
    mutation.mutate({ id: artistId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(artistId) });
        if (!isFollowing) {
          trackEvent.mutate({ data: { eventType: "engagement", eventName: "follow", contentType: "user" as const, contentId: artistId } });
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <Skeleton className="w-full h-64 rounded-xl" />
        <div className="flex gap-8 px-8 -mt-16 relative z-10">
          <Skeleton className="w-48 h-48 rounded-full border-4 border-background" />
          <div className="pt-16 space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!artist) return <div className="p-8 text-center text-muted-foreground">Artist not found</div>;

  return (
    <div className="space-y-12 pb-24">
      {/* Back navigation */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Banner / Profile Video */}
      <div className="w-full h-64 md:h-80 rounded-xl overflow-hidden bg-secondary border border-border relative">
        {(artist as any).profileVideoUrl ? (
          <video
            ref={(el) => { videoRef.current = el; if (el) { el.volume = volume; el.muted = volume === 0; } }}
            style={{ pointerEvents: 'none' }}
            src={(artist as any).profileVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : artist.bannerUrl ? (
          <img src={artist.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        {(artist as any).profileVideoUrl && (
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

      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-8 -mt-16 md:-mt-24 relative z-10">
        <div className="relative w-32 h-32 md:w-48 md:h-48 flex-shrink-0">
          <div className="w-full h-full rounded-full overflow-hidden bg-card border-4 border-background shadow-2xl">
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt={artist.stageName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl md:text-5xl font-bold text-muted-foreground bg-secondary">
                {artist.stageName.charAt(0)}
              </div>
            )}
          </div>
          <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 bg-background rounded-full p-1 shadow-lg">
            <RoleBadges role={(artist as any).userRole ?? "artist"} isVerified={artist.isVerified} verificationType={(artist as any).verificationType} size="md" />
          </div>
        </div>
        <div className="pt-2 md:pt-16 flex-1 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter flex items-center gap-2 md:gap-3 flex-wrap">
              {artist.stageName}
              <RoleBadges role={(artist as any).userRole ?? "artist"} isVerified={artist.isVerified} verificationType={(artist as any).verificationType} size="lg" />
            </h1>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 text-muted-foreground font-medium text-sm">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {artist.followerCount?.toLocaleString() || 0} followers</span>
              <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {artist.songCount || 0} tracks</span>
              {artist.labelName && (
                <span className="text-primary">Label: {artist.labelName}</span>
              )}
            </div>
            {artistBadges && artistBadges.length > 0 && (
              <BadgeList userBadges={artistBadges as any} size="sm" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <Button size="sm" className="rounded-full px-5 md:px-8 font-bold md:text-base md:h-11" onClick={() => { if (artist.songs?.[0]) play({ id: artist.songs[0].id, title: artist.songs[0].title, artistName: artist.songs[0].artistName ?? "", artistId: artist.songs[0].artistId, artistUserRole: (artist.songs[0] as any).artistUserRole ?? (artist as any).userRole ?? null, artistIsVerified: (artist.songs[0] as any).artistIsVerified ?? (artist as any).isVerified ?? false, coverUrl: artist.songs[0].coverUrl, streamUrl: artist.songs[0].streamUrl, duration: artist.songs[0].duration }); }}>
              <Play className="w-4 h-4 mr-1.5 fill-current" /> Play
            </Button>
            {user && (
              <Button 
                variant={artist.isFollowed ? "outline" : "secondary"} 
                size="sm"
                className="rounded-full px-4 md:px-6 md:text-base md:h-11"
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {artist.isFollowed ? "Following" : "Follow"}
              </Button>
            )}
            {user && (artist as any).userId && user.id !== (artist as any).userId && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 md:px-6 gap-1.5 md:text-base md:h-11"
                onClick={() => navigate(`/messages?new=${(artist as any).userId}`)}
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </Button>
            )}
            {user?.id === (artist as any).userId && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-4 md:px-6 gap-1.5 md:text-base md:h-11"
                onClick={() => {
                  setEditStageName(artist.stageName ?? "");
                  setEditBio((artist as any).bio ?? "");
                  setEditGenre(artist.genre ?? "");
                  setEditProfileOpen(true);
                }}
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </Button>
            )}
            {user &&
              user.id !== (artist as any).userId &&
              (user as any).username?.trim().toLowerCase() === artist.stageName.trim().toLowerCase() && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                onClick={handleClaim}
                disabled={isClaiming}
              >
                {isClaiming
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Claiming…</>
                  : <><ShieldCheck className="w-4 h-4" />Claim Artist Profile</>}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 gap-2 border-violet-500/50 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
                onClick={() => { setAssignOpen(true); setAssignSearch(""); setAssignSelected(null); setAssignResults([]); }}
              >
                <UserCog className="w-4 h-4" />
                Assign to User
              </Button>
            )}
            {isAdmin && (artist as any).userId && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleUnlink}
                disabled={unlinkLoading}
              >
                {unlinkLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Unlinking…</>
                  : <><UserMinus className="w-4 h-4" />Unlink Profile</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {artistUserId && (
        <div className="px-4 md:px-8 pt-2 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Events</p>
          <EventsTab userId={artistUserId} isOwner={user?.id === artistUserId} />
        </div>
      )}

      {editProfileOpen && (
        <div className="bg-secondary/40 rounded-xl border border-border p-4 space-y-3 mx-4 md:mx-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Edit Profile</span>
            <button onClick={() => setEditProfileOpen(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stage Name</label>
            <Input value={editStageName} onChange={e => setEditStageName(e.target.value)} placeholder="Your artist name…" className="h-8 text-sm bg-secondary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
            <Input value={editGenre} onChange={e => setEditGenre(e.target.value)} placeholder="e.g. Hip-Hop, Electronic…" className="h-8 text-sm bg-secondary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bio</label>
            <Textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell your fans about yourself…" className="text-sm bg-secondary/50 min-h-[80px] resize-y" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditProfileOpen(false)} className="h-7 text-xs">Cancel</Button>
            <Button
              size="sm"
              disabled={updateArtistMutation.isPending || !editStageName.trim()}
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                updateArtistMutation.mutate(
                  { id: artistId, data: { stageName: editStageName.trim(), bio: editBio.trim() || undefined, genre: editGenre.trim() || undefined } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getGetArtistQueryKey(artistId) });
                      setEditProfileOpen(false);
                      toast({ title: "Profile updated" });
                    },
                    onError: () => toast({ variant: "destructive", title: "Failed to update profile" }),
                  }
                );
              }}
            >
              <Save className="w-3 h-3" /> {updateArtistMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="px-8">
        <Tabs defaultValue="tracks">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
            <TabsTrigger value="tracks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Popular Tracks</TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Videos</TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">About</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tracks" className="pt-6">
            {artist.songs && artist.songs.length > 0 ? (
              <div className="space-y-2">
                {artist.songs.map((song, idx) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors"
                    onClick={() => play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: (song as any).artistUserRole ?? (artist as any).userRole ?? null, artistIsVerified: (song as any).artistIsVerified ?? (artist as any).isVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration })}
                  >
                    <span className="w-6 text-center text-muted-foreground text-sm group-hover:hidden">{idx + 1}</span>
                    <Play className="w-4 h-4 fill-current text-primary hidden group-hover:block ml-1 mr-1" />
                    <div className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                      {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 font-medium flex items-center gap-2">
                      {song.title}
                      {(song as any).releaseType && (song as any).releaseType !== "single" && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          (song as any).releaseType === "ep"
                            ? "border-purple-500/40 text-purple-400 bg-purple-500/5"
                            : "border-primary/40 text-primary bg-primary/5"
                        }`}>
                          {(song as any).releaseType === "ep" ? "EP" : "Album"}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm w-32">{song.playCount?.toLocaleString() || 0} plays</div>
                    <Link href={`/songs/${song.id}`} onClick={(e) => e.stopPropagation()} className="text-muted-foreground text-sm w-16 text-right hover:text-primary">
                      {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                    </Link>
                    <SongMenu song={song} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity w-7 h-7" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8">No tracks available.</p>
            )}
          </TabsContent>

          <TabsContent value="videos" className="pt-6">
             {artist.videos && artist.videos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {artist.videos.map((video) => (
                    <div key={video.id} className="group cursor-pointer space-y-3">
                      <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-border">
                        {video.thumbnailUrl
                          ? <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Play className="w-8 h-8" /></div>
                        }
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-4 transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg"
                            title={`Play ${video.title}`}
                            onClick={() => play({ id: video.id, title: video.title, artistName: (video as any).artistName ?? artist.stageName ?? "", artistId: video.artistId, artistUserRole: (video as any).artistUserRole ?? (artist as any).userRole ?? null, artistIsVerified: (artist as any).isVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: (video as any).videoUrl, duration: video.duration })}
                          >
                            <Play className="w-8 h-8 fill-current ml-1" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/videos/${video.id}`}>
                          <h4 className="font-medium text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
             ) : (
               <p className="text-muted-foreground py-8">No videos available.</p>
             )}
          </TabsContent>
          
          <TabsContent value="about" className="pt-6">
            <div className="max-w-3xl">
              <h3 className="text-xl font-bold mb-4">Biography</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {artist.bio || "No biography provided."}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Admin: Assign to User dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-violet-400" />
              Assign Artist Profile
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Link <span className="font-semibold text-foreground">{artist?.stageName}</span> to any user account.
            This overrides the normal username-matching requirement.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by username…"
              value={assignSearch}
              onChange={e => handleAssignSearchChange(e.target.value)}
              autoFocus
            />
            {assignSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {assignResults.length > 0 && !assignSelected && (
            <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
              {assignResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setAssignSelected({ id: u.id, username: u.username }); setAssignSearch(u.displayName ?? u.username); setAssignResults([]); }}
                  className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(u.displayName ?? u.username)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName ?? u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username} · {u.role.replace("_", " ")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {assignSelected && (
            <div className="flex items-center gap-3 px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-md">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold flex-shrink-0 text-violet-300">
                {assignSelected.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-violet-300">@{assignSelected.username}</p>
                <p className="text-xs text-muted-foreground">Selected</p>
              </div>
              <button onClick={() => { setAssignSelected(null); setAssignSearch(""); }} className="text-muted-foreground hover:text-foreground text-xs">
                Clear
              </button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssignConfirm}
              disabled={!assignSelected || assignLoading}
              className="gap-2"
            >
              {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
              Assign Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
