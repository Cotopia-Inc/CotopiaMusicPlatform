import { useGetHomeFeed, getGetHomeFeedQueryKey } from "@workspace/api-client-react";
import { Play, Radio, BadgeCheck, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/player";

export default function Home() {
  const { play } = usePlayer();
  const { data: feed, isLoading } = useGetHomeFeed({
    query: { queryKey: getGetHomeFeedQueryKey() }
  });

  return (
    <div className="space-y-14 pb-24">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden min-h-[280px] flex items-end p-8 border border-border/50 group cursor-pointer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571330735066-03aaa9429d89?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        <div className="relative z-20 space-y-4 max-w-xl">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Everyday Radio</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter leading-none">
            The sound of<br />
            <span className="text-primary">tomorrow</span>, today.
          </h2>
          <p className="text-muted-foreground text-base">
            Discover emerging artists, stream exclusive content, and connect with a community that lives for music.
          </p>
          <div className="flex gap-3 pt-2">
            <Link href="/discover">
              <button className="bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-full flex items-center gap-2 hover:scale-105 transition-transform text-sm shadow-lg shadow-primary/25">
                <Play className="w-4 h-4 fill-current" /> Start Listening
              </button>
            </Link>
            <Link href="/artists">
              <button className="bg-secondary text-secondary-foreground font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-secondary/80 transition-colors border border-border">
                Explore Artists
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Songs */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold tracking-tight">Featured Tracks</h3>
          <Link href="/songs">
            <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">See all →</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : feed?.featuredSongs?.length ? (
            feed.featuredSongs.map((song) => (
              <div key={song.id} className="group cursor-pointer space-y-3">
                <Link href={`/songs/${song.id}`}>
                  <div className="aspect-square relative overflow-hidden rounded-xl bg-secondary border border-border/50 shadow-md">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary">
                        <Radio className="w-8 h-8 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg"
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>
                    {song.isFeatured && (
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[9px] bg-primary/80 backdrop-blur px-1.5 py-0.5">Featured</Badge>
                      </div>
                    )}
                  </div>
                </Link>
                <div>
                  <Link href={`/songs/${song.id}`}>
                    <h4 className="font-semibold text-sm truncate leading-tight hover:text-primary transition-colors">{song.title}</h4>
                  </Link>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{song.artistName}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8 text-sm">No featured tracks yet.</div>
          )}
        </div>
      </section>

      {/* Trending Videos */}
      {(feed?.featuredVideos?.length || isLoading) && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">Trending Videos</h3>
            </div>
            <Link href="/videos">
              <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">See all →</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : feed?.featuredVideos?.map((video) => (
              <Link key={video.id} href={`/videos/${video.id}`}>
                <div className="group cursor-pointer space-y-3">
                  <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-secondary border border-border/50 shadow-md">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                    </div>
                    {video.status === "published" && (
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[9px] bg-primary/80 backdrop-blur px-1.5 py-0.5">Featured</Badge>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm truncate">{video.title}</h4>
                    <p className="text-xs text-muted-foreground">{video.artistName}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Artists */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold tracking-tight">Artists to Watch</h3>
          <Link href="/artists">
            <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">See all →</span>
          </Link>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6">
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
              <div key={i} className="space-y-3 text-center">
                <Skeleton className="w-full aspect-square rounded-full mx-auto" />
                <Skeleton className="h-3 w-2/3 mx-auto" />
              </div>
            ))
          ) : feed?.featuredArtists?.length ? (
            feed.featuredArtists.map((artist) => (
              <Link key={artist.id} href={`/artists/${artist.id}`}>
                <div className="group cursor-pointer space-y-3 text-center">
                  <div className="aspect-square relative overflow-hidden rounded-full bg-secondary border-2 border-border group-hover:border-primary/50 transition-colors shadow-md mx-auto">
                    {artist.avatarUrl ? (
                      <img src={artist.avatarUrl} alt={artist.stageName} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground bg-gradient-to-br from-primary/20 to-secondary">
                        {artist.stageName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs truncate flex items-center justify-center gap-0.5">
                      {artist.stageName}
                      <BadgeCheck className="w-3 h-3 text-primary flex-shrink-0" />
                    </h4>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8 text-sm">No featured artists yet.</div>
          )}
        </div>
      </section>

      {/* Powered by Cotopia footer */}
      <div className="flex items-center justify-center gap-2 py-4 opacity-40">
        <Radio className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Everyday Radio · Powered by Cotopia</span>
      </div>
    </div>
  );
}
