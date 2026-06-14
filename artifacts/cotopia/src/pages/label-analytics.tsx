import { useGetLabelAnalytics } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BarChart3, Play, Eye, Users, TrendingUp, ArrowLeft, Home } from "lucide-react";
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

export default function LabelAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && user.role !== "label") navigate("/");
  }, [user, navigate]);

  const { data, isLoading } = useGetLabelAnalytics();

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
        <p className="text-muted-foreground">No analytics available. Make sure your label profile is set up.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <span className="text-muted-foreground/30">·</span>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Home className="w-4 h-4" />Home
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Label Analytics</h1>
          <p className="text-sm text-muted-foreground">Performance of your roster on Everyday Radio</p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Artists on Roster" value={data.totalArtists} icon={Users} color="text-purple-400" />
        <StatCard label="Total Plays" value={data.totalPlays} icon={Play} />
        <StatCard label="Total Views" value={data.totalViews} icon={Eye} color="text-blue-400" />
        <StatCard label="Total Followers" value={data.totalFollowers} icon={TrendingUp} color="text-green-400" />
      </div>

      {/* Top Artists */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Artist Roster Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No artists on your roster yet.{" "}
              <Link href="/submit" className="text-primary hover:underline">Submit artists</Link> to get started.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-2 pb-2 border-b border-border/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                <span className="w-5">#</span>
                <span>Artist</span>
                <span className="w-20 text-right">Plays</span>
                <span className="w-20 text-right">Views</span>
                <span className="w-20 text-right">Followers</span>
              </div>
              {data.topArtists.map((artist, i) => (
                <Link href={`/artists/${artist.id}`} key={artist.id}>
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center hover:bg-muted/50 rounded-lg px-2 py-2.5 cursor-pointer transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {artist.avatarUrl
                        ? <img src={artist.avatarUrl} alt={artist.stageName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">{artist.stageName?.[0]?.toUpperCase()}</div>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{artist.stageName}</p>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm font-bold">{(artist.totalPlays ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">plays</p>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm font-bold">{(artist.totalViews ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">views</p>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm font-bold">{(artist.followerCount ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">followers</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Grow your roster</p>
              <p className="text-sm text-muted-foreground mt-1">
                Submit your artists for review on Everyday Radio to expand your reach. Approved submissions are published automatically.
              </p>
              <Link href="/submit">
                <button className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline">
                  Submit an artist →
                </button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
