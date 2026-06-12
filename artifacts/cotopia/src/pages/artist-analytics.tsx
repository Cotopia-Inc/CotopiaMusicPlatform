import { useGetArtistAnalytics } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BarChart3, Play, Eye, Heart, Users, TrendingUp, Music, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

function StatCard({ label, value, icon: Icon, color = "text-primary" }: { label: string; value: number; icon: React.ElementType; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className="text-xl font-bold mt-1 tabular-nums break-all leading-tight">{value.toLocaleString()}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ArtistAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && user.role !== "artist") navigate("/");
  }, [user, navigate]);

  const { data, isLoading } = useGetArtistAnalytics();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No analytics available. Make sure your artist profile is set up.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">My Analytics</h1>
          <p className="text-sm text-muted-foreground">Your music performance on Everyday Radio</p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Plays" value={data.totalPlays} icon={Play} />
        <StatCard label="Total Views" value={data.totalViews} icon={Eye} color="text-blue-400" />
        <StatCard label="Followers" value={data.followerCount} icon={Users} color="text-purple-400" />
        <StatCard label="Favorites" value={data.totalFavorites} icon={Heart} color="text-pink-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Songs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Music className="w-4 h-4 text-primary" />
              Top Songs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No published songs yet</p>
            ) : (
              <div className="space-y-3">
                {data.topSongs.map((song: any, i: number) => (
                  <Link href={`/songs/${song.id}`} key={song.id}>
                    <div className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 cursor-pointer transition-colors">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt={song.title} className="w-9 h-9 rounded object-cover flex-shrink-0" />
                        : <div className="w-9 h-9 rounded bg-muted flex-shrink-0 flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground">{song.genre ?? "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{(song.playCount ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">plays</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Videos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              Top Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No published videos yet</p>
            ) : (
              <div className="space-y-3">
                {data.topVideos.map((video: any, i: number) => (
                  <Link href={`/videos/${video.id}`} key={video.id}>
                    <div className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 cursor-pointer transition-colors">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                      {video.thumbnailUrl
                        ? <img src={video.thumbnailUrl} alt={video.title} className="w-9 h-9 rounded object-cover flex-shrink-0" />
                        : <div className="w-9 h-9 rounded bg-muted flex-shrink-0 flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{video.title}</p>
                        <p className="text-xs text-muted-foreground">{video.genre ?? "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{(video.viewCount ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">views</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Grow your audience</p>
              <p className="text-sm text-muted-foreground mt-1">
                Submit more music to get featured on Everyday Radio's playlists. Use the Submit page to upload your latest tracks and videos.
              </p>
              <Link href="/submit">
                <button className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline">
                  Submit music →
                </button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
