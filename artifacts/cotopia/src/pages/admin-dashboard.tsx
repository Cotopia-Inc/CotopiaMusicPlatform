import { useGetAdminAnalytics, getGetAdminAnalyticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Music, Video, PlayCircle, Eye, MessageSquare, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminAnalytics({
    query: { queryKey: getGetAdminAnalyticsQueryKey() }
  });

  const cards = [
    { title: "Total Users", value: stats?.totalUsers, icon: Users, color: "text-blue-500" },
    { title: "Total Songs", value: stats?.totalSongs, icon: Music, color: "text-purple-500" },
    { title: "Total Videos", value: stats?.totalVideos, icon: Video, color: "text-pink-500" },
    { title: "Total Plays", value: stats?.totalPlays, icon: PlayCircle, color: "text-green-500" },
    { title: "Total Views", value: stats?.totalViews, icon: Eye, color: "text-orange-500" },
    { title: "Comments", value: stats?.totalComments, icon: MessageSquare, color: "text-yellow-500" },
    { title: "Pending Submissions", value: stats?.pendingSubmissions, icon: AlertCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform analytics and metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className="bg-card border-border shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <div className="text-3xl font-bold">{card.value?.toLocaleString() || 0}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Songs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : stats?.topSongs?.length ? (
              stats.topSongs.map((song, i) => (
                <div key={song.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-sm">{song.title}</p>
                      <p className="text-xs text-muted-foreground">{song.artistName}</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium">{song.playCount?.toLocaleString()} plays</div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : stats?.topVideos?.length ? (
              stats.topVideos.map((video, i) => (
                <div key={video.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-sm">{video.title}</p>
                      <p className="text-xs text-muted-foreground">{video.artistName}</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium">{video.viewCount?.toLocaleString()} views</div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
