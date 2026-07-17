import { useParams, Link, useLocation } from "wouter";
import { useRef, useState } from "react";
import { LinkifiedText } from "@/components/linkified-text";
import { useGetLabel, getGetLabelQueryKey, useFollowLabel, useUnfollowLabel, useGetCreatorSupportStatus } from "@workspace/api-client-react";
import { SupportButton } from "@/components/support-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Music, Play, Volume2, VolumeX, UserPlus, X, Search, Loader2, ShieldCheck, Heart, Instagram, Twitter, Linkedin, ExternalLink } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { UserLink } from "@/components/user-link";
import { RoleBadges } from "@/components/role-badges";
import { BadgeList } from "@/components/badge-chip";
import { useGetUserBadges, getGetUserBadgesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSeo } from "@/hooks/use-seo";
import { EventsTab } from "@/components/events-tab";
import { SupportWall } from "@/components/support-wall";

export default function LabelDetail() {
  const { id } = useParams();
  const labelId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0);

  const [showAddArtist, setShowAddArtist] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; stageName: string; avatarUrl: string | null; labelId: number | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [rosterBusy, setRosterBusy] = useState<number | null>(null);

  const { data: label, isLoading } = useGetLabel(labelId, {
    query: { enabled: !!labelId, queryKey: getGetLabelQueryKey(labelId) }
  });

  useSeo({
    title: label ? label.name : "Label",
    description: label
      ? (label as any)?.bio?.trim() || `Explore ${label.name}'s roster of artists on Everyday Radio by Cotopia.`
      : undefined,
    image: (label as any)?.logoUrl ?? undefined,
    type: "profile",
    noindex: !label,
    jsonLd: label
      ? {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: label.name,
        }
      : undefined,
  });

  const labelUserId = (label as any)?.userId as number | null | undefined;
  const { data: labelBadges } = useGetUserBadges(labelUserId!, {
    query: { enabled: !!labelUserId, queryKey: getGetUserBadgesQueryKey(labelUserId!) }
  });
  const { data: labelSupportStatus } = useGetCreatorSupportStatus(labelUserId ?? 0, undefined, {
    query: { enabled: !!labelUserId, queryKey: ["getCreatorSupportStatus", labelUserId] },
  });

  const followMutation = useFollowLabel();
  const unfollowMutation = useUnfollowLabel();

  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);

  const isOwner = !!(user && label && (label as any).userId === user.id);

  async function handleClaim() {
    if (!user) return;
    setIsClaiming(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/labels/${labelId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Claim failed");
      }
      toast({ title: "Label profile claimed!", description: "This label is now linked to your account." });
      queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not claim label", description: err.message });
    } finally {
      setIsClaiming(false);
    }
  }

  const handleFollowToggle = () => {
    if (!label) return;
    const mutation = label.isFollowed ? unfollowMutation : followMutation;
    mutation.mutate({ id: labelId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
      }
    });
  };

  const searchArtists = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/artists?q=${encodeURIComponent(q)}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addArtist = async (artistId: number) => {
    setRosterBusy(artistId);
    try {
      await fetch(`/api/labels/${labelId}/artists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
        },
        body: JSON.stringify({ artistId }),
      });
      queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
      setSearchResults(prev => prev.filter(a => a.id !== artistId));
    } finally {
      setRosterBusy(null);
    }
  };

  const removeArtist = async (artistId: number) => {
    setRosterBusy(artistId);
    try {
      await fetch(`/api/labels/${labelId}/artists/${artistId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });
      queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
    } finally {
      setRosterBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <Skeleton className="w-full h-48 rounded-xl" />
        <div className="flex gap-8 px-8 -mt-12 relative z-10">
          <Skeleton className="w-40 h-40 rounded-xl border-4 border-background" />
          <div className="pt-16 space-y-4">
            <Skeleton className="h-10 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!label) return <div className="p-8 text-center text-muted-foreground">Label not found</div>;

  return (
    <div className="space-y-12 pb-24">
      {/* Banner / Profile Video */}
      <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden bg-secondary border border-border relative">
        {(label as any).profileVideoUrl ? (
          <video
            ref={(el) => { videoRef.current = el; if (el) { el.volume = volume; el.muted = volume === 0; } }}
            style={{ pointerEvents: 'none' }}
            src={(label as any).profileVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : label.bannerUrl ? (
          <img src={label.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-50" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        {(label as any).profileVideoUrl && (
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
      <div className="flex flex-col md:flex-row gap-8 px-8 -mt-20 relative z-10 items-end">
        <div className="w-40 h-40 rounded-xl overflow-hidden bg-card border-4 border-background shadow-2xl flex items-center justify-center p-4">
          {label.logoUrl ? (
            <img src={label.logoUrl} alt={label.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-3xl font-bold text-muted-foreground">{label.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">{label.name}<RoleBadges role={(label as any).userRole ?? "label"} isVerified={label.isVerified ?? false} verificationType={(label as any).verificationType} size="md" /></h1>
            <div className="flex items-center gap-4 text-muted-foreground font-medium text-sm">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {label.followerCount?.toLocaleString() || 0} followers</span>
              <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {label.artistCount || 0} artists</span>
              {labelSupportStatus?.supportEnabled && (
                <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {(labelSupportStatus.supporterCount ?? 0).toLocaleString()} supporters</span>
              )}
            </div>
            {labelBadges && labelBadges.length > 0 && (
              <BadgeList userBadges={labelBadges as any} size="sm" />
            )}
          </div>
          <div className="flex gap-3">
            {user && !isOwner && (
              <Button
                variant={label.isFollowed ? "outline" : "default"}
                size="lg"
                className="rounded-full px-6"
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {label.isFollowed ? "Following Label" : "Follow Label"}
              </Button>
            )}
            <SupportButton
              creatorUserId={labelUserId}
              creatorName={label.name}
              contentType="label"
              contentId={label.id}
              size="default"
              className="px-6"
            />
            {user &&
              !isOwner &&
              (user as any).username?.trim().toLowerCase() === label.name.trim().toLowerCase() && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                onClick={handleClaim}
                disabled={isClaiming}
              >
                {isClaiming
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Claiming…</>
                  : <><ShieldCheck className="w-4 h-4" />Claim Label Profile</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {labelUserId && (
        <div className="px-8 pt-2">
          <EventsTab userId={labelUserId} isOwner={isOwner} heading="Events" />
        </div>
      )}

      <div className="px-8">
        <Tabs defaultValue="releases">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
            <TabsTrigger value="releases" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Recent Releases</TabsTrigger>
            <TabsTrigger value="artists" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Roster</TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">About</TabsTrigger>
          </TabsList>

          <TabsContent value="releases" className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {label.recentReleases && label.recentReleases.length > 0 ? (
                label.recentReleases.map((song) => (
                  <div key={song.id} className="group cursor-pointer space-y-3" onClick={() => navigate(`/songs/${song.id}`)}>
                    <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                      {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm truncate">{song.title}</h4>
                      <UserLink
                        username={song.artistName}
                        artistId={song.artistId}
                        role={(song as any).artistUserRole}
                        isVerified={(song as any).artistIsVerified ?? false}
                        className="text-xs text-muted-foreground"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-muted-foreground py-8">No releases available.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="artists" className="pt-6">
            {/* Add Artist panel — label owner only */}
            {isOwner && (
              <div className="mb-6">
                {!showAddArtist ? (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddArtist(true)}>
                    <UserPlus className="w-4 h-4" /> Add Artist to Roster
                  </Button>
                ) : (
                  <div className="border border-border rounded-xl p-4 space-y-3 bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Search for an artist to add</p>
                      <button onClick={() => { setShowAddArtist(false); setSearchQuery(""); setSearchResults([]); }} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by artist name…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); searchArtists(e.target.value); }}
                        className="pl-9 bg-background"
                        autoFocus
                      />
                      {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {searchResults.map(a => {
                          const alreadyOnRoster = label.artists?.some(ra => ra.id === a.id);
                          return (
                            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {a.avatarUrl ? <img src={a.avatarUrl} alt={a.stageName} className="w-full h-full object-cover" /> : a.stageName.charAt(0)}
                                </div>
                                <span className="text-sm font-medium">{a.stageName}</span>
                                {a.labelId && a.labelId !== labelId && <span className="text-xs text-muted-foreground">(signed elsewhere)</span>}
                              </div>
                              {alreadyOnRoster ? (
                                <span className="text-xs text-muted-foreground">On roster</span>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addArtist(a.id)} disabled={rosterBusy === a.id}>
                                  {rosterBusy === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {searchQuery && !searching && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No artists found</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
              {label.artists && label.artists.length > 0 ? (
                label.artists.map((artist) => (
                  <div key={artist.id} className="relative group">
                    <Link href={`/artists/${artist.id}`}>
                      <div className="cursor-pointer space-y-4 text-center">
                        <div className="w-full aspect-square relative overflow-hidden rounded-full bg-secondary border border-border">
                          {artist.avatarUrl ? (
                            <img src={artist.avatarUrl} alt={artist.stageName} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                              {artist.stageName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm flex items-center justify-center gap-1 flex-wrap"><span className="truncate">{artist.stageName}</span><RoleBadges role={(artist as any).userRole ?? "artist"} isVerified={(artist as any).isVerified} size="sm" /></h4>
                      </div>
                    </Link>
                    {isOwner && (
                      <button
                        className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title="Remove from roster"
                        onClick={() => removeArtist(artist.id)}
                        disabled={rosterBusy === artist.id}
                      >
                        {rosterBusy === artist.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="col-span-full text-muted-foreground py-8">No artists on roster.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="about" className="pt-6">
            <div className="max-w-3xl space-y-4">
              <h3 className="text-xl font-bold">About Label</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {label.bio ? <LinkifiedText text={label.bio} /> : "No information provided."}
              </p>
              {(label.instagramUrl || label.xUrl || label.tiktokUrl || label.linkedinUrl || label.pinterestUrl) && (
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  {label.instagramUrl && (
                    <a href={label.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-pink-400 transition-colors" title="Instagram">
                      <Instagram className="w-4 h-4" /><span>Instagram</span>
                    </a>
                  )}
                  {label.xUrl && (
                    <a href={label.xUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="X / Twitter">
                      <Twitter className="w-4 h-4" /><span>X</span>
                    </a>
                  )}
                  {label.tiktokUrl && (
                    <a href={label.tiktokUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="TikTok">
                      <ExternalLink className="w-3.5 h-3.5" /><span>TikTok</span>
                    </a>
                  )}
                  {label.linkedinUrl && (
                    <a href={label.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors" title="LinkedIn">
                      <Linkedin className="w-4 h-4" /><span>LinkedIn</span>
                    </a>
                  )}
                  {label.pinterestUrl && (
                    <a href={label.pinterestUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors" title="Pinterest">
                      <ExternalLink className="w-3.5 h-3.5" /><span>Pinterest</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        {labelUserId && (
          <div className="mt-8">
            <SupportWall userId={labelUserId} />
          </div>
        )}
      </div>
    </div>
  );
}
