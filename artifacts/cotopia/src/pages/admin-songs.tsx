import { useListSongs, getListSongsQueryKey, useUpdateSong } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Star, Sparkles, EyeOff, Eye, Loader2, AlertTriangle } from "lucide-react";
import { UserLink } from "@/components/user-link";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";

export default function AdminSongs() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);

  const { data, isLoading } = useListSongs(
    { q: search, limit: 100 },
    { query: { queryKey: getListSongsQueryKey({ q: search, limit: 100 }) } }
  );

  const updateSong = useUpdateSong();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSongsQueryKey({ q: search, limit: 100 }) });

  const handleToggleFeature = (id: number, currentFeatured: boolean | null | undefined) => {
    setPendingId(id);
    updateSong.mutate(
      { id, data: { isFeatured: !currentFeatured } },
      {
        onSuccess: () => {
          toast({ title: currentFeatured ? "Removed from featured" : "Song featured!" });
          invalidate();
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update song" }),
        onSettled: () => setPendingId(null),
      }
    );
  };

  const handleTogglePublish = (id: number, currentStatus: string | null | undefined) => {
    const isPublished = currentStatus === "published";
    const newStatus = isPublished ? "unpublished" : "published";
    setPendingId(id);
    updateSong.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: isPublished ? "Song unpublished" : "Song published!" });
          invalidate();
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update song" }),
        onSettled: () => setPendingId(null),
      }
    );
  };

  return (
    <>
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Song Management</h1>
        <p className="text-muted-foreground">Feature, publish, and manage all songs on the platform.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-secondary"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>Song</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Plays</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.items?.length ? (
              data.items.map((song) => {
                const isPublished = song.status === "published";
                const isBusy = pendingId === song.id && updateSong.isPending;
                return (
                  <TableRow key={song.id} className={!isPublished ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                          {song.coverUrl ? (
                            <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/10" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{song.title}</p>
                          {song.albumName && <p className="text-xs text-muted-foreground">{song.albumName}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserLink username={song.artistName ?? ""} artistId={song.artistId} role={song.artistUserRole} isVerified={song.artistIsVerified ?? false} className="text-sm text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      {song.genre
                        ? <Badge variant="secondary" className="text-xs">{song.genre}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{song.playCount?.toLocaleString() || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-primary text-primary" />
                        <span className="text-xs">{song.avgRating ? song.avgRating.toFixed(1) : '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            isPublished
                              ? "text-green-400 border-green-500/40 bg-green-500/5"
                              : "text-muted-foreground border-border"
                          }`}
                        >
                          {isPublished ? "Published" : song.status || "Unpublished"}
                        </Badge>
                        {song.isFeatured && (
                          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 border px-1.5">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Publish / Unpublish */}
                        <Button
                          variant="outline"
                          size="sm"
                          className={`text-xs gap-1.5 ${
                            isPublished
                              ? "text-muted-foreground hover:text-red-400 hover:border-red-400/40"
                              : "text-green-400 border-green-500/40 hover:bg-green-500/10"
                          }`}
                          onClick={() => handleTogglePublish(song.id, song.status)}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isPublished ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          {isPublished ? "Unpublish" : "Publish"}
                        </Button>

                        {/* Feature / Unfeature */}
                        <Button
                          variant={song.isFeatured ? "default" : "outline"}
                          size="sm"
                          className={`text-xs gap-1.5 ${song.isFeatured ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30 border" : ""}`}
                          onClick={() => handleToggleFeature(song.id, song.isFeatured)}
                          disabled={isBusy}
                        >
                          <Sparkles className="w-3 h-3" />
                          {song.isFeatured ? "Unfeature" : "Feature"}
                        </Button>

                        {/* Issue Strike */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => setStrikeTarget({
                            userId: (song as any).uploaderId ?? (song as any).userId ?? 0,
                            uploaderName: song.artistName ?? "Unknown",
                            contentType: "song",
                            contentId: song.id,
                            contentTitle: song.title,
                          })}
                        >
                          <AlertTriangle className="w-3 h-3" />Strike
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No songs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>

    <CopyrightStrikeModal
      target={strikeTarget}
      onClose={() => setStrikeTarget(null)}
    />
    </>
  );
}
