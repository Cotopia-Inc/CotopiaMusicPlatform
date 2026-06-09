import { useListEditorialPlaylists, useAdminListSubmissions } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { BookOpen, ListMusic, FileText, Music, Video, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const EDITOR_ROLES = ["editor", "admin", "master_admin"];

const PLAYLIST_TYPE_LABELS: Record<string, string> = {
  featured: "Featured",
  mood: "Mood",
  genre: "Genre Mix",
  new_artist: "New Artists",
  cotopia_picks: "Cotopia Picks",
  radio_picks: "Radio Picks",
  user: "User",
};

export default function EditorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && !EDITOR_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const { data: playlists, isLoading: playlistsLoading } = useListEditorialPlaylists();
  const { data: pendingSubmissions } = useAdminListSubmissions({ status: "pending_review" });

  const recentPlaylists = (playlists ?? []).slice(0, 5);
  const pendingCount = Array.isArray(pendingSubmissions) ? pendingSubmissions.length : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Editor Dashboard</h1>
            <p className="text-sm text-muted-foreground">Curate content for Everyday Radio</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Editorial Playlists</p>
                <p className="text-2xl font-bold mt-1">{playlists?.length ?? 0}</p>
              </div>
              <ListMusic className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Submissions</p>
                <p className="text-2xl font-bold mt-1">{pendingCount}</p>
              </div>
              <FileText className="w-8 h-8 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Songs Curated</p>
                <p className="text-2xl font-bold mt-1">
                  {(playlists ?? []).reduce((sum: number, p: any) => sum + (p.songCount ?? 0), 0)}
                </p>
              </div>
              <Music className="w-8 h-8 text-purple-400/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/editor/playlists">
            <Card className="hover:border-primary/50 cursor-pointer transition-colors h-full">
              <CardContent className="pt-5 pb-5">
                <ListMusic className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-semibold">Manage Playlists</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create and curate editorial playlists</p>
              </CardContent>
            </Card>
          </Link>
          {(user?.role === "admin" || user?.role === "master_admin") && (
            <>
              <Link href="/admin/upload-song">
                <Card className="hover:border-primary/50 cursor-pointer transition-colors h-full">
                  <CardContent className="pt-5 pb-5">
                    <Music className="w-5 h-5 text-primary mb-2" />
                    <p className="text-sm font-semibold">Upload Song</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct publish, no payment</p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/admin/upload-video">
                <Card className="hover:border-primary/50 cursor-pointer transition-colors h-full">
                  <CardContent className="pt-5 pb-5">
                    <Video className="w-5 h-5 text-primary mb-2" />
                    <p className="text-sm font-semibold">Upload Video</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct publish, no payment</p>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Recent playlists */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Editorial Playlists</h2>
          <Link href="/editor/playlists">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {playlistsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentPlaylists.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center px-6">
                <ListMusic className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No editorial playlists yet</p>
                <Link href="/editor/playlists">
                  <Button size="sm" className="gap-2 mt-1">
                    <Plus className="w-4 h-4" />Create First Playlist
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentPlaylists.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    {p.coverUrl
                      ? <img src={p.coverUrl} alt={p.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ListMusic className="w-5 h-5 text-primary" />
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.songCount} songs · {PLAYLIST_TYPE_LABELS[p.playlistType] ?? p.playlistType}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
