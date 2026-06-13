import { useGetAdminAnalytics } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BarChart3, Music, Video, Users, Play, Eye, MessageSquare, Clock, TrendingUp, Star, Globe, UserCheck } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{typeof value === "number" ? value.toLocaleString() : value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin") navigate("/");
  }, [user, navigate]);

  const { data, isLoading } = useGetAdminAnalytics();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    listener: "bg-blue-500/20 text-blue-400",
    artist: "bg-purple-500/20 text-purple-400",
    label: "bg-pink-500/20 text-pink-400",
    admin: "bg-amber-500/20 text-amber-400",
    master_admin: "bg-red-500/20 text-red-400",
    editor: "bg-green-500/20 text-green-400",
    moderator: "bg-cyan-500/20 text-cyan-400",
    business: "bg-orange-500/20 text-orange-400",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Platform Analytics</h1>
          <p className="text-sm text-muted-foreground">Live overview of Everyday Radio</p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data?.totalUsers ?? 0} icon={Users} />
        <StatCard label="Published Songs" value={data?.totalSongs ?? 0} icon={Music} />
        <StatCard label="Published Videos" value={data?.totalVideos ?? 0} icon={Video} />
        <StatCard label="Pending Review" value={data?.pendingSubmissions ?? 0} icon={Clock} sub="submissions awaiting" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Plays" value={data?.totalPlays ?? 0} icon={Play} />
        <StatCard label="Total Views" value={data?.totalViews ?? 0} icon={Eye} />
        <StatCard label="Comments" value={data?.totalComments ?? 0} icon={MessageSquare} />
        <StatCard label="Artists" value={(data as any)?.totalArtists ?? 0} icon={Star} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Page Views" value={(data as any)?.totalPageViews ?? 0} icon={Globe} sub="total tracked page visits" />
        <StatCard label="Unique Visitors" value={(data as any)?.totalUniqueVisitors ?? 0} icon={UserCheck} sub="distinct logged-in visitors" />
      </div>

      {/* Users by role */}
      {data?.usersByRole && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.usersByRole).sort(([, a], [, b]) => b - a).map(([role, cnt]) => (
                <div key={role} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${roleColors[role] ?? "bg-muted text-muted-foreground"}`}>
                  <span className="capitalize">{role.replace("_", " ")}</span>
                  <span className="font-bold">{cnt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Top Songs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.topSongs ?? []).slice(0, 10).map((song: any, i: number) => (
                <div key={song.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  {song.coverUrl
                    ? <img src={song.coverUrl} alt={song.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-0.5"><span className="truncate">{song.artistName}</span><RoleTag role="artist" size="sm" /></p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold">{(song.playCount ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">plays</p>
                  </div>
                </div>
              ))}
              {(!data?.topSongs || data.topSongs.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No songs yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Videos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Top Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.topVideos ?? []).slice(0, 10).map((video: any, i: number) => (
                <div key={video.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  {video.thumbnailUrl
                    ? <img src={video.thumbnailUrl} alt={video.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{video.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-0.5"><span className="truncate">{video.artistName}</span><RoleTag role="artist" size="sm" /></p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold">{(video.viewCount ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
              {(!data?.topVideos || data.topVideos.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No videos yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
