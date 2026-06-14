import { useParams, Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useGetArtist, getGetArtistQueryKey, useFollowArtist, useUnfollowArtist, useTrackAnalyticsEvent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Users, Music, MessageCircle, ArrowLeft } from "lucide-react";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ArtistDetail() {
  const { id } = useParams();
  const artistId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { play } = usePlayer();
  const [, navigate] = useLocation();

  const { data: artist, isLoading } = useGetArtist(artistId, {
    query: { enabled: !!artistId, queryKey: getGetArtistQueryKey(artistId) }
  });

  const followMutation = useFollowArtist();
  const unfollowMutation = useUnfollowArtist();
  const trackEvent = useTrackAnalyticsEvent();

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
            src={(artist as any).profileVideoUrl}
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : artist.bannerUrl ? (
          <img src={artist.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-60" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-8 px-8 -mt-24 relative z-10">
        <div className="relative w-48 h-48 flex-shrink-0">
          <div className="w-full h-full rounded-full overflow-hidden bg-card border-4 border-background shadow-2xl">
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt={artist.stageName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-muted-foreground bg-secondary">
                {artist.stageName.charAt(0)}
              </div>
            )}
          </div>
          <div className="absolute bottom-2 right-2 bg-background rounded-full p-1 shadow-lg">
            <RoleBadges role={(artist as any).userRole ?? "artist"} isVerified={artist.isVerified} size="md" />
          </div>
        </div>
        <div className="pt-4 md:pt-16 flex-1 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-extrabold tracking-tighter flex items-center gap-3">
              {artist.stageName}
              <RoleBadges role={(artist as any).userRole ?? "artist"} isVerified={artist.isVerified} size="lg" />
            </h1>
            <div className="flex items-center gap-4 text-muted-foreground font-medium">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {artist.followerCount?.toLocaleString() || 0} followers</span>
              <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {artist.songCount || 0} tracks</span>
              {artist.labelName && (
                <span className="text-primary">Label: {artist.labelName}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button size="lg" className="rounded-full px-8 font-bold" onClick={() => { if (artist.songs?.[0]) play({ id: artist.songs[0].id, title: artist.songs[0].title, artistName: artist.songs[0].artistName ?? "", artistId: artist.songs[0].artistId, artistIsVerified: (artist.songs[0] as any).artistIsVerified ?? false, coverUrl: artist.songs[0].coverUrl, streamUrl: artist.songs[0].streamUrl, duration: artist.songs[0].duration }); }}>
              <Play className="w-5 h-5 mr-2 fill-current" /> Play
            </Button>
            {user && (
              <Button 
                variant={artist.isFollowed ? "outline" : "secondary"} 
                size="lg" 
                className="rounded-full px-6"
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {artist.isFollowed ? "Following" : "Follow"}
              </Button>
            )}
            {user && (artist as any).userId && user.id !== (artist as any).userId && (
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 gap-2"
                onClick={() => navigate(`/messages?new=${(artist as any).userId}`)}
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </Button>
            )}
          </div>
        </div>
      </div>

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
                    onClick={() => play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistIsVerified: (song as any).artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration })}
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
                            onClick={() => play({ id: video.id, title: video.title, artistName: (video as any).artistName ?? artist.stageName ?? "", artistId: video.artistId, artistIsVerified: (artist as any).isVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: (video as any).videoUrl, duration: video.duration })}
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
    </div>
  );
}
