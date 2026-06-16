import { useState } from "react";
import { useListSongs, getListSongsQueryKey, useUpdateSong, useListVideos, getListVideosQueryKey, useUpdateVideo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Star, Sparkles, Video, Music, Home, Compass, Loader2 } from "lucide-react";
import { UserLink } from "@/components/user-link";

type Tab = "songs" | "videos";

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-[10px] text-primary/70">{sub}</p>
      </div>
    </div>
  );
}

export default function AdminDiscover() {
  const [tab, setTab] = useState<Tab>("songs");
  const [songSearch, setSongSearch] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: songsData, isLoading: songsLoading } = useListSongs(
    { limit: 200 },
    { query: { queryKey: getListSongsQueryKey({ limit: 200 }) } }
  );
  const { data: videosData, isLoading: videosLoading } = useListVideos(
    { limit: 200 },
    { query: { queryKey: getListVideosQueryKey({ limit: 200 }) } }
  );

  const updateSong = useUpdateSong();
  const updateVideo = useUpdateVideo();

  const allSongs = songsData?.items ?? [];
  const allVideos = videosData?.items ?? [];
  const featuredSongCount = allSongs.filter(s => s.isFeatured).length;
  const featuredVideoCount = allVideos.filter(v => v.isFeatured).length;

  const filteredSongs = allSongs.filter(s =>
    !songSearch || s.title.toLowerCase().includes(songSearch.toLowerCase()) || (s.artistName ?? "").toLowerCase().includes(songSearch.toLowerCase())
  );
  const filteredVideos = allVideos.filter(v =>
    !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase()) || (v.artistName ?? "").toLowerCase().includes(videoSearch.toLowerCase())
  );

  function toggleSongFeature(id: number, current: boolean | null | undefined) {
    setPendingId(id);
    updateSong.mutate({ id, data: { isFeatured: !current } }, {
      onSuccess: () => {
        toast({ title: current ? "Removed from featured" : "Song featured on Home & Discover!" });
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey({ limit: 200 }) });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update" }),
      onSettled: () => setPendingId(null),
    });
  }

  function toggleVideoFeature(id: number, current: boolean | null | undefined) {
    setPendingId(id);
    updateVideo.mutate({ id, data: { isFeatured: !current } }, {
      onSuccess: () => {
        toast({ title: current ? "Removed from featured" : "Video featured on Home & Discover!" });
        queryClient.invalidateQueries({ queryKey: getListVideosQueryKey({ limit: 200 }) });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update" }),
      onSettled: () => setPendingId(null),
    });
  }

  const TabBtn = ({ t, label, icon }: { t: Tab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Discover & Home Curation</h1>
        <p className="text-muted-foreground">
          Feature songs and videos to promote them on the <strong>Home page</strong> and the <strong>Discover tab</strong>.
          Changes apply instantly.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Star className="w-5 h-5" />} label="Featured Songs" value={featuredSongCount} sub="Shown on Home + Discover" />
        <StatCard icon={<Sparkles className="w-5 h-5" />} label="Featured Videos" value={featuredVideoCount} sub="Shown on Home + Discover" />
        <StatCard icon={<Music className="w-5 h-5" />} label="Total Songs" value={allSongs.length} sub="Published songs" />
        <StatCard icon={<Video className="w-5 h-5" />} label="Total Videos" value={allVideos.length} sub="Published videos" />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
        <div className="flex gap-2 flex-shrink-0 mt-0.5">
          <Home className="w-4 h-4 text-amber-400" />
          <Compass className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-sm text-amber-200">
          Featuring a song or video places it in the <strong>Featured</strong> section on both the <strong>Home page</strong> and the <strong>Discover tab</strong>. Unfeature to remove it from both.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <TabBtn t="songs" label={`Songs (${featuredSongCount} featured)`} icon={<Music className="w-4 h-4" />} />
        <TabBtn t="videos" label={`Videos (${featuredVideoCount} featured)`} icon={<Video className="w-4 h-4" />} />
      </div>

      {tab === "songs" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search songs..." value={songSearch} onChange={e => setSongSearch(e.target.value)} className="pl-9 bg-secondary/50 border-secondary" />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Song</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Feature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songsLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell></TableRow>
                  ))
                ) : filteredSongs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No songs found.</TableCell></TableRow>
                ) : filteredSongs.map(song => (
                  <TableRow key={song.id} className={song.isFeatured ? "bg-amber-500/5" : undefined}>
                    <TableCell>
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-secondary border border-border flex-shrink-0">
                        {song.coverUrl
                          ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground/40" /></div>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">{song.title}</TableCell>
                    <TableCell>
                      <UserLink username={song.artistName ?? ""} artistId={song.artistId} role={song.artistUserRole === "artist" ? "artist" : undefined} isVerified={song.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{song.genre ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{song.playCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={song.status === "published" ? "default" : "secondary"} className="text-xs capitalize">{song.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {song.isFeatured && (
                        <Badge className="mr-2 text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 border">Featured</Badge>
                      )}
                      <Button
                        size="sm" variant={song.isFeatured ? "default" : "outline"}
                        disabled={pendingId === song.id}
                        className={`text-xs gap-1.5 ${song.isFeatured ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30 border" : ""}`}
                        onClick={() => toggleSongFeature(song.id, song.isFeatured)}
                      >
                        {pendingId === song.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                        {song.isFeatured ? "Unfeature" : "Feature"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "videos" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search videos..." value={videoSearch} onChange={e => setVideoSearch(e.target.value)} className="pl-9 bg-secondary/50 border-secondary" />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Feature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videosLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell></TableRow>
                  ))
                ) : filteredVideos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No videos found.</TableCell></TableRow>
                ) : filteredVideos.map(video => (
                  <TableRow key={video.id} className={video.isFeatured ? "bg-amber-500/5" : undefined}>
                    <TableCell>
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-secondary border border-border flex-shrink-0">
                        {video.thumbnailUrl
                          ? <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground/40" /></div>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">{video.title}</TableCell>
                    <TableCell>
                      <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole === "artist" ? "artist" : undefined} isVerified={video.artistIsVerified ?? false} className="text-xs text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{video.genre ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{video.viewCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={video.status === "published" ? "default" : "secondary"} className="text-xs capitalize">{video.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {video.isFeatured && (
                        <Badge className="mr-2 text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 border">Featured</Badge>
                      )}
                      <Button
                        size="sm" variant={video.isFeatured ? "default" : "outline"}
                        disabled={pendingId === video.id}
                        className={`text-xs gap-1.5 ${video.isFeatured ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30 border" : ""}`}
                        onClick={() => toggleVideoFeature(video.id, video.isFeatured)}
                      >
                        {pendingId === video.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {video.isFeatured ? "Unfeature" : "Feature"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
