import { useParams, Link, useLocation } from "wouter";
import { useRef, useState, useEffect } from "react";
import { useGetLabel, getGetLabelQueryKey, useFollowLabel, useUnfollowLabel } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Music, Play, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { UserLink } from "@/components/user-link";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LabelDetail() {
  const { id } = useParams();
  const labelId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(0.8);


  const { data: label, isLoading } = useGetLabel(labelId, {
    query: { enabled: !!labelId, queryKey: getGetLabelQueryKey(labelId) }
  });

  const followMutation = useFollowLabel();
  const unfollowMutation = useUnfollowLabel();

  const handleFollowToggle = () => {
    if (!label) return;
    const mutation = label.isFollowed ? unfollowMutation : followMutation;
    mutation.mutate({ id: labelId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
      }
    });
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
            <div onPointerDown={(e) => e.stopPropagation()} className="w-24">
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
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-2">{label.name}<RoleBadges role={(label as any).userRole ?? "label"} isVerified={label.isVerified ?? false} size="md" /></h1>
            <div className="flex items-center gap-4 text-muted-foreground font-medium text-sm">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {label.followerCount?.toLocaleString() || 0} followers</span>
              <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {label.artistCount || 0} artists</span>
            </div>
          </div>
          <div className="flex gap-3">
            {user && (
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
          </div>
        </div>
      </div>

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
                        role="artist"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
              {label.artists && label.artists.length > 0 ? (
                label.artists.map((artist) => (
                  <Link key={artist.id} href={`/artists/${artist.id}`}>
                    <div className="group cursor-pointer space-y-4 text-center">
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
                ))
              ) : (
                <p className="col-span-full text-muted-foreground py-8">No artists on roster.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="about" className="pt-6">
            <div className="max-w-3xl">
              <h3 className="text-xl font-bold mb-4">About Label</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {label.bio || "No information provided."}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
