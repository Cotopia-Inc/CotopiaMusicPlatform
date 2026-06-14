import { useGetDiscover, getGetDiscoverQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Star, Video as VideoIcon } from "lucide-react";
import { Link } from "wouter";
import { usePlayer } from "@/lib/player";
import { UserLink } from "@/components/user-link";
import { SongMenu } from "@/components/song-menu";

export default function Discover() {
  const { play } = usePlayer();
  const { data: discover, isLoading } = useGetDiscover({
    query: { queryKey: getGetDiscoverQueryKey() }
  });

  const hasFeatured = (discover?.featuredSongs?.length ?? 0) > 0 || (discover?.featuredVideos?.length ?? 0) > 0;

  return (
    <div className="space-y-12 pb-24">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Discover</h1>
        <p className="text-muted-foreground text-lg">Find your next favorite sound on Everyday Radio.</p>
      </div>

      {/* ── Featured (admin-curated) ── */}
      {(isLoading || hasFeatured) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-400 fill-current" />
            <h3 className="text-2xl font-bold tracking-tight">Featured</h3>
            <span className="text-xs text-muted-foreground bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 ml-1">Curated</span>
          </div>

          {/* Featured Songs */}
          {(isLoading || (discover?.featuredSongs?.length ?? 0) > 0) && (
            <>
              {!isLoading && (discover?.featuredVideos?.length ?? 0) > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">Songs</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-6">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-square rounded-md" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : discover?.featuredSongs?.map((song) => (
                  <div key={song.id} className="group cursor-pointer space-y-3">
                    <Link href={`/songs/${song.id}`}>
                      <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-amber-500/20 ring-1 ring-amber-500/10">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className="bg-amber-500/90 text-black text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wider">Featured</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                            title={`Play ${song.title}`}
                            onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                          >
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </button>
                        </div>
                      </div>
                    </Link>
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/songs/${song.id}`}>
                          <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                        </Link>
                        <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                      </div>
                      <UserLink username={song.artistName} artistId={song.artistId} role="artist" isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Featured Videos */}
          {!isLoading && (discover?.featuredVideos?.length ?? 0) > 0 && (
            <>
              {(discover?.featuredSongs?.length ?? 0) > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5"><VideoIcon className="w-3 h-3" /> Videos</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {discover?.featuredVideos?.map((video) => (
                  <div key={video.id} className="group cursor-pointer space-y-3">
                    <Link href={`/videos/${video.id}`}>
                      <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-amber-500/20 ring-1 ring-amber-500/10">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><VideoIcon className="w-8 h-8 opacity-30" /></div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className="bg-amber-500/90 text-black text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wider">Featured</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-4 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                            title={`Play ${video.title}`}
                            onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                          >
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </button>
                        </div>
                      </div>
                    </Link>
                    <div>
                      <Link href={`/videos/${video.id}`}>
                        <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                      </Link>
                      <UserLink username={video.artistName ?? ""} artistId={video.artistId} role="artist" isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Trending Now</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : discover?.trendingSongs?.length ? (
            discover.trendingSongs.map((song) => (
              <div key={song.id} className="group cursor-pointer space-y-3">
                <Link href={`/songs/${song.id}`}>
                  <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${song.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                  </div>
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <Link href={`/songs/${song.id}`}>
                      <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                    </Link>
                    <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                  </div>
                  <UserLink username={song.artistName} artistId={song.artistId} role="artist" isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No trending tracks found.</div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Top Rated</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : discover?.topRatedSongs?.length ? (
            discover.topRatedSongs.map((song) => (
              <div key={song.id} className="group cursor-pointer space-y-3">
                <Link href={`/songs/${song.id}`}>
                  <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${song.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                  </div>
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <Link href={`/songs/${song.id}`}>
                      <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                    </Link>
                    <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                  </div>
                  <UserLink username={song.artistName} artistId={song.artistId} role="artist" isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No top rated tracks found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
