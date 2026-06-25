import { useGetAdminAnalytics, getGetAdminAnalyticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Music, Video, PlayCircle, Eye, MessageSquare, AlertCircle, Mic2, Building2, DollarSign, Radio, ChevronRight, Megaphone, ArrowLeft, Home } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminAnalytics({
    query: { queryKey: getGetAdminAnalyticsQueryKey() }
  });

  const statCards = [
    { title: "Total Users", value: stats?.totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { title: "Artists", value: stats?.usersByRole?.["artist"] ?? "—", icon: Mic2, color: "text-violet-400", bg: "bg-violet-500/10" },
    { title: "Labels", value: stats?.usersByRole?.["label"] ?? "—", icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { title: "Songs", value: stats?.totalSongs, icon: Music, color: "text-purple-400", bg: "bg-purple-500/10" },
    { title: "Videos", value: stats?.totalVideos, icon: Video, color: "text-pink-400", bg: "bg-pink-500/10" },
    { title: "Total Plays", value: stats?.totalPlays, icon: PlayCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { title: "Total Views", value: stats?.totalViews, icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10" },
    { title: "Comments", value: stats?.totalComments, icon: MessageSquare, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { title: "Pending Review", value: stats?.pendingSubmissions, icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { title: "Revenue", value: "$—", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10", raw: true },
  ];

  const adminPages = [
    { href: "/admin/users", label: "User Management", desc: "View, suspend, and manage users", icon: Users },
    { href: "/admin/submissions", label: "Submissions", desc: "Review pending content submissions", icon: AlertCircle },
    { href: "/admin/songs", label: "Songs", desc: "Feature, approve, and manage songs", icon: Music },
    { href: "/admin/videos", label: "Videos", desc: "Feature, approve, and manage videos", icon: Video },
    { href: "/admin/company", label: "Company Hub", desc: "Create and manage announcements and articles", icon: Megaphone },
    { href: "/admin/comments", label: "Comments", desc: "Moderate and delete comments", icon: MessageSquare },
    { href: "/admin/settings", label: "App Settings", desc: "Platform name, branding, and settings", icon: Radio },
  ];

  return (
    <div className="space-y-10 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Everyday Radio</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and management — Powered by Cotopia</p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400 font-semibold">Platform Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Platform Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i} className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`p-1.5 rounded-md ${card.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {card.raw ? card.value : (typeof card.value === 'number' ? card.value.toLocaleString() : card.value ?? 0)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Admin Pages */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Admin Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminPages.map((page) => {
            const Icon = page.icon;
            return (
              <Link key={page.href} href={page.href}>
                <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer group">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{page.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{page.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Top Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top Songs</CardTitle>
            <Link href="/admin/songs">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">View all</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : stats?.topSongs?.length ? (
              stats.topSongs.map((song, i) => (
                <div key={song.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground text-sm w-5 text-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-sm">{song.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-0.5"><span className="truncate">{song.artistName}</span><RoleTag role={(song as any).artistUserRole} size="sm" /></p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{song.playCount?.toLocaleString()} plays</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">No data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top Videos</CardTitle>
            <Link href="/admin/videos">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">View all</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : stats?.topVideos?.length ? (
              stats.topVideos.map((video, i) => (
                <div key={video.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground text-sm w-5 text-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-sm">{video.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-0.5"><span className="truncate">{video.artistName}</span><RoleTag role={(video as any).artistUserRole} size="sm" /></p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{video.viewCount?.toLocaleString()} views</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">No data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
