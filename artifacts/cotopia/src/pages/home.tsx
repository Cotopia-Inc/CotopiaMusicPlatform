import { useGetHomeFeed, getGetHomeFeedQueryKey } from "@workspace/api-client-react";
import { Play, Radio, TrendingUp, Video, Sparkles, Compass, Music2 } from "lucide-react";
import { RoleBadges } from "@/components/role-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { UserLink } from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/player";
import { useSeo } from "@/hooks/use-seo";

export default function Home() {
  const { play } = usePlayer();
  const { data: feed, isLoading } = useGetHomeFeed({
    query: { queryKey: getGetHomeFeedQueryKey() }
  });

  useSeo({
    title: "Everyday Radio by Cotopia",
    description:
      "Cotopia — Everyday Radio. Discover emerging artists, stream exclusive music and videos, and connect with a community that lives for music.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Cotopia",
      alternateName: "Everyday Radio",
      url: window.location.origin,
    },
  });

  const editorPicks = feed?.editorPicks ?? [];

  return (
    <div className="space-y-14 pb-24">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden min-h-[280px] md:min-h-[340px] flex items-end p-5 md:p-8 border border-border/50 group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571330735066-03aaa9429d89?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        <div className="relative z-20 space-y-4 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <img src="/logo.jpg" alt="Cotopia" className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Everyday Radio · Powered by Cotopia</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Beta</span>
          </div>
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter leading-none">
              More than music.<br />
              <span className="text-primary">More than radio.</span>
            </h2>
          </div>
          <ul className="text-muted-foreground text-base space-y-1">
            <li>Discover exclusive artists.</li>
            <li>Experience new technology.</li>
            <li>Help build the future.</li>
          </ul>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
            <span aria-hidden="true">🎤</span> Featuring Asia Qu
          </div>
          <p className="text-xs text-muted-foreground/70">
            Only available on Everyday Radio during Beta.
          </p>
          <div className="flex gap-3 pt-2 flex-wrap">
            <Link href="/songs/37">
              <button className="bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-full flex items-center gap-2 hover:scale-105 transition-transform text-sm shadow-lg shadow-primary/25">
                <Play className="w-4 h-4 fill-current" /> Listen Now
              </button>
            </Link>
            <Link href="/videos/15">
              <button className="bg-secondary text-secondary-foreground font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-secondary/80 transition-colors border border-border flex items-center gap-2">
                <span aria-hidden="true">🎵</span> Watch It Work
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Editor's Picks */}
      {(isLoading || editorPicks.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xl font-bold tracking-tight">Editor's Picks</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Curated</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border border-border bg-card">
                  <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : editorPicks.map((pick) => {
              const isSong = pick.contentType === "song";
              const isVideo = pick.contentType === "video";
              const isArtist = pick.contentType === "artist";
              const art = isSong ? pick.song?.coverUrl : isVideo ? pick.video?.thumbnailUrl : (pick.artist as any)?.avatarUrl;
              const title = isSong ? pick.song?.title : isVideo ? pick.video?.title : (pick.artist as any)?.stageName;
              const sub = isSong ? pick.song?.artistName : isVideo ? pick.video?.artistName : (pick.artist as any)?.genre;
              const href = isSong ? `/songs/${pick.contentId}` : isVideo ? `/videos/${pick.contentId}` : `/artists/${pick.contentId}`;

              return (
                <div key={pick.id} className="group relative bg-card border border-border/60 hover:border-amber-400/30 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/5">
                  <div className="flex items-center gap-3 p-3">
                    {/* Art */}
                    <Link href={href}>
                      <div className={`w-14 h-14 overflow-hidden bg-secondary flex-shrink-0 ${isArtist ? "rounded-full border-2 border-border" : "rounded-lg"}`}>
                        {art
                          ? <img src={art} alt={title ?? ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                              {isSong ? <Music2 className="w-5 h-5" /> : isVideo ? <Video className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                            </div>
                        }
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded ${
                          isSong ? "text-purple-400 bg-purple-400/10" :
                          isVideo ? "text-blue-400 bg-blue-400/10" :
                          "text-amber-400 bg-amber-400/10"
                        }`}>
                          {pick.contentType}
                        </span>
                      </div>
                      {isArtist ? (
                        <Link href={href}>
                          <h4 className="font-semibold text-sm hover:text-primary transition-colors leading-tight flex items-center gap-1">
                            <span className="truncate">{title}</span>
                            <RoleBadges role="artist" isVerified={(pick.artist as any)?.isVerified ?? false} />
                          </h4>
                        </Link>
                      ) : (
                        <Link href={href}>
                          <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors leading-tight">{title}</h4>
                        </Link>
                      )}
                      {isSong && pick.song?.artistName && (
                        <UserLink username={pick.song.artistName} artistId={pick.song.artistId} role={(pick.song as any).artistUserRole} isVerified={(pick.song as any).artistIsVerified ?? false} className="text-xs text-muted-foreground mt-0.5" />
                      )}
                      {isVideo && pick.video?.artistName && (
                        <UserLink username={pick.video.artistName} artistId={pick.video.artistId} role={(pick.video as any).artistUserRole} isVerified={(pick.video as any).artistIsVerified ?? false} className="text-xs text-muted-foreground mt-0.5" />
                      )}
                      {isArtist && (pick.artist as any)?.genre && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{(pick.artist as any).genre}</p>
                      )}
                      {pick.note && (
                        <p className="text-[10px] text-amber-400/70 italic truncate mt-1">"{pick.note}"</p>
                      )}
                    </div>

                    {/* Play button for song/video */}
                    {(isSong && pick.song) && (
                      <button
                        onClick={() => play({ id: pick.song!.id, title: pick.song!.title, artistName: pick.song!.artistName ?? "", artistId: pick.song!.artistId, artistUserRole: (pick.song as any).artistUserRole ?? null, artistIsVerified: (pick.song as any).artistIsVerified ?? false, coverUrl: pick.song!.coverUrl, streamUrl: pick.song!.streamUrl, duration: pick.song!.duration })}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title={`Play ${pick.song.title}`}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}
                    {(isVideo && pick.video) && (
                      <button
                        onClick={() => play({ id: pick.video!.id, title: pick.video!.title, artistName: pick.video!.artistName ?? "", artistId: pick.video!.artistId, artistUserRole: (pick.video as any).artistUserRole ?? null, artistIsVerified: (pick.video as any).artistIsVerified ?? false, coverUrl: pick.video!.thumbnailUrl, videoUrl: pick.video!.videoUrl, duration: pick.video!.duration })}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title={`Play ${pick.video.title}`}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}
                  </div>

                  {/* Bottom amber accent line */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Songs */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold tracking-tight">Featured Tracks</h3>
          <Link href="/songs">
            <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">See all →</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
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
                        title={`Play ${song.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
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
                  <UserLink
                    username={song.artistName}
                    artistId={song.artistId}
                    role={song.artistUserRole}
                    isVerified={song.artistIsVerified ?? false}
                    className="text-xs text-muted-foreground mt-0.5"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8 text-sm">No featured tracks yet.</div>
          )}
        </div>
      </section>

      {/* Discover section */}
      {(isLoading || (feed?.newReleases?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <h3 className="text-xl font-bold tracking-tight">Discover Something New</h3>
            </div>
            <Link href="/discover">
              <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">Full Discover →</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {isLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : (feed?.newReleases ?? []).slice(0, 6).map((song) => (
              <div key={song.id} className="group cursor-pointer space-y-2">
                <Link href={`/songs/${song.id}`}>
                  <div className="aspect-square relative overflow-hidden rounded-lg bg-secondary border border-border/50">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary">
                        <Radio className="w-6 h-6 text-primary/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-2.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${song.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: song.artistUserRole ?? null, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    </div>
                    <div className="absolute top-1.5 right-1.5">
                      <Badge variant="secondary" className="text-[8px] px-1 py-px opacity-80">New</Badge>
                    </div>
                  </div>
                </Link>
                <div>
                  <Link href={`/songs/${song.id}`}>
                    <p className="text-xs font-semibold truncate hover:text-primary transition-colors">{song.title}</p>
                  </Link>
                  <UserLink
                    username={song.artistName}
                    artistId={song.artistId}
                    role={song.artistUserRole}
                    isVerified={song.artistIsVerified ?? false}
                    className="text-[10px] text-muted-foreground"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="w-full aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : feed?.featuredVideos?.map((video) => (
              <div key={video.id} className="group cursor-pointer space-y-3">
                <Link href={`/videos/${video.id}`}>
                  <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-secondary border border-border/50 shadow-md">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                        <Video className="w-10 h-10 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                        title={`Play ${video.title}`}
                        onClick={(e) => { e.preventDefault(); play({ id: video.id, title: video.title, artistName: video.artistName ?? "", artistId: video.artistId, artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false, coverUrl: video.thumbnailUrl, videoUrl: video.videoUrl, duration: video.duration }); }}
                      >
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </button>
                    </div>
                    {video.isFeatured && (
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[9px] bg-primary/80 backdrop-blur px-1.5 py-0.5">Featured</Badge>
                      </div>
                    )}
                  </div>
                </Link>
                <div>
                  <Link href={`/videos/${video.id}`}>
                    <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{video.title}</h4>
                  </Link>
                  <UserLink
                    username={video.artistName}
                    artistId={video.artistId}
                    role={video.artistUserRole}
                    isVerified={video.artistIsVerified ?? false}
                    className="text-xs text-muted-foreground"
                  />
                </div>
              </div>
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
        <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
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
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs flex items-center justify-center gap-0.5 min-w-0">
                      <span className="truncate min-w-0">{artist.stageName}</span>
                      <RoleBadges role="artist" isVerified={artist.isVerified} size="sm" />
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

      {/* Footer */}
      <div className="py-8 border-t border-border/30 mt-4 space-y-3">
        <div className="flex items-center justify-center gap-2 opacity-60">
          <Radio className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Everyday Radio · Powered by Cotopia</span>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center max-w-2xl mx-auto leading-relaxed px-4">
          Everyday Radio by Cotopia is an independent platform for music, video, discovery, promotion, and community. Users retain ownership of their content and grant Cotopia limited rights to host, stream, display, and promote submitted content. Powered by Cotopia.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {[
            { href: "/about", label: "Our Promise" },
            { href: "/legal", label: "Legal Center" },
            { href: "/legal/terms", label: "Terms" },
            { href: "/legal/privacy", label: "Privacy" },
            { href: "/legal/dmca", label: "DMCA" },
            { href: "/legal/copyright-complaint", label: "Copyright Complaint" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
