import { useGetDiscover, getGetDiscoverQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Star, Video as VideoIcon, Music, Sparkles, TrendingUp, MessageSquare, Users, Building2 } from "lucide-react";
import { Link } from "wouter";
import { usePlayer } from "@/lib/player";
import { UserLink } from "@/components/user-link";
import { SongMenu } from "@/components/song-menu";
import { useSeo } from "@/hooks/use-seo";
import { AiOriginBadge, type CreationMethod } from "@/components/ai-origin-badge";
import { usePlatformConfig } from "@/lib/platform-config";

export default function Discover() {
  const { play } = usePlayer();
  const config = usePlatformConfig();
  const { data: discover, isLoading } = useGetDiscover({
    query: { queryKey: getGetDiscoverQueryKey() }
  });

  useSeo({
    title: "Discover Music & Videos",
    description: "Find your next favorite sound on Everyday Radio. Explore trending, top-rated, and featured songs and videos from independent artists.",
  });

  const hasFeatured = (discover?.featuredSongs?.length ?? 0) > 0 || (discover?.featuredVideos?.length ?? 0) > 0;

  return (
    <div className="space-y-12 pb-24">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Discover</h1>
        <p className="text-muted-foreground text-base md:text-lg">Find your next favorite sound on Everyday Radio.</p>
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
                            onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                          >
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </button>
                        </div>
                        {(song as any).effectiveDisplayTag && (
                          <AiOriginBadge
                            method={(song as any).effectiveDisplayTag as CreationMethod}
                            variant="cover"
                            showHumanBadge={config.showHumanBadge}
                            showAiBadge={config.showAiBadge}
                            showHybridBadge={config.showHybridBadge}
                            showFullyAiBadge={config.showFullyAiBadge}
                            showCoverOverlays={config.showCoverOverlays}
                          />
                        )}
                      </div>
                    </Link>
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/songs/${song.id}`}>
                          <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                        </Link>
                        <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                      </div>
                      <UserLink username={song.artistName} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
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
                            onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                          >
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </button>
                        </div>
                        {(video as any).effectiveDisplayTag && (
                          <AiOriginBadge
                            method={(video as any).effectiveDisplayTag as CreationMethod}
                            variant="cover"
                            showHumanBadge={config.showHumanBadge}
                            showAiBadge={config.showAiBadge}
                            showHybridBadge={config.showHybridBadge}
                            showFullyAiBadge={config.showFullyAiBadge}
                            showCoverOverlays={config.showCoverOverlays}
                          />
                        )}
                      </div>
                    </Link>
                    <div>
                      <Link href={`/videos/${video.id}`}>
                        <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                      </Link>
                      <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Top Rated ── */}
      {(isLoading || discover?.showTopRated !== false) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <h3 className="text-2xl font-bold tracking-tight">Top Rated</h3>
            <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5 ml-1">By Rating</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : (discover?.topRatedSongs?.length ?? 0) > 0 ? (
              discover!.topRatedSongs!.map((song, idx) => {
                const songAny = song as any;
                return (
                  <div key={song.id} className="group cursor-pointer space-y-3">
                    <Link href={`/songs/${song.id}`}>
                      <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-yellow-500/20 ring-1 ring-yellow-500/10">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                        )}
                        {/* Rank badge */}
                        <div className="absolute top-2 left-2">
                          <span className="bg-yellow-500/90 text-black text-[9px] font-bold rounded px-1.5 py-0.5">#{idx + 1}</span>
                        </div>
                        {/* Avg rating badge */}
                        {songAny.avgRating && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/70 rounded px-1.5 py-0.5">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-white text-[10px] font-bold tabular-nums">{Number(songAny.avgRating).toFixed(1)}</span>
                            {songAny.ratingCount > 0 && (
                              <span className="text-white/60 text-[9px] tabular-nums ml-0.5">({songAny.ratingCount})</span>
                            )}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                            title={`Play ${song.title}`}
                            onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                          >
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </button>
                        </div>
                        {songAny.effectiveDisplayTag && (
                          <AiOriginBadge
                            method={songAny.effectiveDisplayTag as CreationMethod}
                            variant="cover"
                            showHumanBadge={config.showHumanBadge}
                            showAiBadge={config.showAiBadge}
                            showHybridBadge={config.showHybridBadge}
                            showFullyAiBadge={config.showFullyAiBadge}
                            showCoverOverlays={config.showCoverOverlays}
                          />
                        )}
                      </div>
                    </Link>
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/songs/${song.id}`}>
                          <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                        </Link>
                        <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                      </div>
                      <UserLink username={song.artistName} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                      {songAny.avgRating && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${Number(songAny.avgRating) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-1">{Number(songAny.avgRating).toFixed(1)}</span>
                          {songAny.ratingCount > 0 && (
                            <span className="text-[10px] text-muted-foreground/50">· {songAny.ratingCount} {songAny.ratingCount === 1 ? 'rating' : 'ratings'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No rated songs yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Be the first to rate a song on its detail page!</p>
              </div>
            )}
          </div>

          {/* ── Top Rated Videos ── */}
          {((discover?.topRatedVideos?.length ?? 0) > 0 || isLoading) && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-8 mb-4 flex items-center gap-1.5">
                <VideoIcon className="w-3.5 h-3.5" /> Top Rated Videos
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-video rounded-md" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : discover!.topRatedVideos!.map((video, idx) => {
                  const vAny = video as any;
                  return (
                    <div key={video.id} className="group cursor-pointer space-y-3">
                      <Link href={`/videos/${video.id}`}>
                        <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-yellow-500/20 ring-1 ring-yellow-500/10">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Thumbnail</div>
                          )}
                          <div className="absolute top-2 left-2">
                            <span className="bg-yellow-500/90 text-black text-[9px] font-bold rounded px-1.5 py-0.5">#{idx + 1}</span>
                          </div>
                          {vAny.avgRating && (
                            <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/70 rounded px-1.5 py-0.5">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-white text-[10px] font-bold tabular-nums">{Number(vAny.avgRating).toFixed(1)}</span>
                              {vAny.ratingCount > 0 && (
                                <span className="text-white/60 text-[9px] tabular-nums ml-0.5">({vAny.ratingCount})</span>
                              )}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                              title={`Play ${video.title}`}
                              onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                            >
                              <Play className="w-6 h-6 fill-current ml-1" />
                            </button>
                          </div>
                          {vAny.effectiveDisplayTag && (
                            <AiOriginBadge
                              method={vAny.effectiveDisplayTag as CreationMethod}
                              variant="cover"
                              showHumanBadge={config.showHumanBadge}
                              showAiBadge={config.showAiBadge}
                              showHybridBadge={config.showHybridBadge}
                              showFullyAiBadge={config.showFullyAiBadge}
                              showCoverOverlays={config.showCoverOverlays}
                            />
                          )}
                        </div>
                      </Link>
                      <div>
                        <Link href={`/videos/${video.id}`}>
                          <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                        </Link>
                        <UserLink username={video.artistName} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                        {vAny.avgRating && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${Number(vAny.avgRating) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                            <span className="text-[10px] text-muted-foreground ml-1">{Number(vAny.avgRating).toFixed(1)}</span>
                            {vAny.ratingCount > 0 && (
                              <span className="text-[10px] text-muted-foreground/50">· {vAny.ratingCount} {vAny.ratingCount === 1 ? 'rating' : 'ratings'}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Trending Now ── */}
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
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                    {(song as any).effectiveDisplayTag && (
                      <AiOriginBadge
                        method={(song as any).effectiveDisplayTag as CreationMethod}
                        variant="cover"
                        showHumanBadge={config.showHumanBadge}
                        showAiBadge={config.showAiBadge}
                        showHybridBadge={config.showHybridBadge}
                        showFullyAiBadge={config.showFullyAiBadge}
                        showCoverOverlays={config.showCoverOverlays}
                      />
                    )}
                  </div>
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <Link href={`/songs/${song.id}`}>
                      <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                    </Link>
                    <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                  </div>
                  <UserLink username={song.artistName} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No trending tracks found.</div>
          )}
        </div>
      </section>

      {/* ── Trending Videos ── */}
      {(isLoading || (discover?.trendingVideos?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-rose-400" />
            <h3 className="text-2xl font-bold tracking-tight">Trending Videos</h3>
            <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5 ml-1">Hot Right Now</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : discover?.trendingVideos?.map((video) => (
              <div key={video.id} className="group cursor-pointer space-y-3">
                <Link href={`/videos/${video.id}`}>
                  <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-border">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><VideoIcon className="w-8 h-8 opacity-30" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-4 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${video.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                    {(video as any).effectiveDisplayTag && (
                      <AiOriginBadge
                        method={(video as any).effectiveDisplayTag as CreationMethod}
                        variant="cover"
                        showHumanBadge={config.showHumanBadge}
                        showAiBadge={config.showAiBadge}
                        showHybridBadge={config.showHybridBadge}
                        showFullyAiBadge={config.showFullyAiBadge}
                        showCoverOverlays={config.showCoverOverlays}
                      />
                    )}
                  </div>
                </Link>
                <div>
                  <Link href={`/videos/${video.id}`}>
                    <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                  </Link>
                  <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Most Discussed ── */}
      {(isLoading || (discover?.mostDiscussed?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            <h3 className="text-2xl font-bold tracking-tight">Most Discussed</h3>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5 ml-1">Fan Favourites</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : discover?.mostDiscussed?.map((song) => {
              const sAny = song as any;
              return (
                <div key={song.id} className="group cursor-pointer space-y-3">
                  <Link href={`/songs/${song.id}`}>
                    <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                      )}
                      {sAny.commentCount > 0 && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/70 rounded px-1.5 py-0.5">
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                          <span className="text-white text-[10px] font-bold tabular-nums">{sAny.commentCount}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                          title={`Play ${song.title}`}
                          onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                        >
                          <Play className="w-6 h-6 fill-current ml-1" />
                        </button>
                      </div>
                      {sAny.effectiveDisplayTag && (
                        <AiOriginBadge
                          method={sAny.effectiveDisplayTag as CreationMethod}
                          variant="cover"
                          showHumanBadge={config.showHumanBadge}
                          showAiBadge={config.showAiBadge}
                          showHybridBadge={config.showHybridBadge}
                          showFullyAiBadge={config.showFullyAiBadge}
                          showCoverOverlays={config.showCoverOverlays}
                        />
                      )}
                    </div>
                  </Link>
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <Link href={`/songs/${song.id}`}>
                        <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                      </Link>
                      <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                    </div>
                    <UserLink username={song.artistName} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    {sAny.commentCount > 0 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sAny.commentCount} {sAny.commentCount === 1 ? "comment" : "comments"}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── New Songs ── */}
      {(isLoading || (discover?.newSongs?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="text-2xl font-bold tracking-tight">New Songs</h3>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 ml-1">Just Released</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : discover?.newSongs?.map((song) => (
              <div key={song.id} className="group cursor-pointer space-y-3">
                <Link href={`/songs/${song.id}`}>
                  <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="bg-primary/90 text-primary-foreground text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wider">New</span>
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${song.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                    {(song as any).effectiveDisplayTag && (
                      <AiOriginBadge
                        method={(song as any).effectiveDisplayTag as CreationMethod}
                        variant="cover"
                        showHumanBadge={config.showHumanBadge}
                        showAiBadge={config.showAiBadge}
                        showHybridBadge={config.showHybridBadge}
                        showFullyAiBadge={config.showFullyAiBadge}
                        showCoverOverlays={config.showCoverOverlays}
                      />
                    )}
                  </div>
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <Link href={`/songs/${song.id}`}>
                      <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                    </Link>
                    <SongMenu song={song} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity" />
                  </div>
                  <UserLink username={song.artistName} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── New Videos ── */}
      {(isLoading || (discover?.newVideos?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="text-2xl font-bold tracking-tight">New Videos</h3>
            <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5 ml-1">Just Released</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : discover?.newVideos?.map((video) => (
              <div key={video.id} className="group cursor-pointer space-y-3">
                <Link href={`/videos/${video.id}`}>
                  <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-border">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><VideoIcon className="w-8 h-8 opacity-30" /></div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="bg-violet-500/90 text-white text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wider">New</span>
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-4 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${video.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                    {(video as any).effectiveDisplayTag && (
                      <AiOriginBadge
                        method={(video as any).effectiveDisplayTag as CreationMethod}
                        variant="cover"
                        showHumanBadge={config.showHumanBadge}
                        showAiBadge={config.showAiBadge}
                        showHybridBadge={config.showHybridBadge}
                        showFullyAiBadge={config.showFullyAiBadge}
                        showCoverOverlays={config.showCoverOverlays}
                      />
                    )}
                  </div>
                </Link>
                <div>
                  <Link href={`/videos/${video.id}`}>
                    <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                  </Link>
                  <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* ── New Artists ── */}
      {(isLoading || (discover?.newArtists?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-2xl font-bold tracking-tight">New Artists</h3>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 ml-1">Just Joined</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-full w-20 h-20 mx-auto" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                  <Skeleton className="h-3 w-1/2 mx-auto" />
                </div>
              ))
            ) : discover?.newArtists?.map((artist) => {
              const aAny = artist as any;
              return (
                <Link key={artist.id} href={`/artists/${artist.id}`}>
                  <div className="group flex flex-col items-center text-center space-y-3 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary flex-shrink-0 border-2 border-border group-hover:border-primary/40 transition-colors">
                      {artist.avatarUrl ? (
                        <img src={artist.avatarUrl} alt={artist.stageName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                          {artist.stageName?.[0]?.toUpperCase() ?? "A"}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm truncate max-w-full">{artist.stageName}</p>
                      {artist.genre && <p className="text-xs text-muted-foreground truncate">{artist.genre}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {aAny.followerCount ?? 0} {(aAny.followerCount ?? 0) === 1 ? "follower" : "followers"} · {aAny.songCount ?? 0} {(aAny.songCount ?? 0) === 1 ? "song" : "songs"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── New Labels ── */}
      {(isLoading || (discover?.newLabels?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-orange-400" />
            <h3 className="text-2xl font-bold tracking-tight">New Labels</h3>
            <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5 ml-1">Independent</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-xl w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : discover?.newLabels?.map((label) => {
              const lAny = label as any;
              return (
                <Link key={label.id} href={`/labels/${label.id}`}>
                  <div className="group flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border group-hover:border-primary/40 transition-colors">
                      {label.logoUrl ? (
                        <img src={label.logoUrl} alt={label.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                          {label.name?.[0]?.toUpperCase() ?? "L"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{label.name}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {lAny.followerCount ?? 0} {(lAny.followerCount ?? 0) === 1 ? "follower" : "followers"} · {lAny.artistCount ?? 0} {(lAny.artistCount ?? 0) === 1 ? "artist" : "artists"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
