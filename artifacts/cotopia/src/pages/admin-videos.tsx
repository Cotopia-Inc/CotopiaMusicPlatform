import { useListVideos, getListVideosQueryKey, useUpdateVideo } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Star, Sparkles, BadgeCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AdminVideos() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListVideos(
    { q: search, limit: 50 },
    { query: { queryKey: getListVideosQueryKey({ q: search, limit: 50 }) } }
  );

  const updateVideo = useUpdateVideo();

  const handleToggleFeature = (id: number, currentFeatured: boolean | null | undefined) => {
    updateVideo.mutate(
      { id, data: { isFeatured: !currentFeatured } },
      {
        onSuccess: () => {
          toast({ title: currentFeatured ? "Video removed from featured" : "Video featured!" });
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey({ q: search, limit: 50 }) });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update video" }),
      }
    );
  };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Video Management</h1>
        <p className="text-muted-foreground">Feature, review, and manage all videos on the platform.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-secondary"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/30">
            <TableRow>
              <TableHead>Video</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Views</TableHead>
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
              data.items.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10" />
                        )}
                      </div>
                      <p className="font-semibold text-sm">{video.title}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground"><span className="flex items-center gap-1">{video.artistName}<BadgeCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /></span></TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{video.genre || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{video.viewCount?.toLocaleString() || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      <span className="text-xs">{video.avgRating ? video.avgRating.toFixed(1) : '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs text-muted-foreground capitalize">{video.status}</Badge>
                      {video.isFeatured && (
                        <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 border px-1.5">
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" />Featured
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={video.isFeatured ? "default" : "outline"}
                      size="sm"
                      className={`text-xs gap-1.5 ${video.isFeatured ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30 border" : ""}`}
                      onClick={() => handleToggleFeature(video.id, video.isFeatured)}
                      disabled={updateVideo.isPending}
                    >
                      <Sparkles className="w-3 h-3" />
                      {video.isFeatured ? "Unfeature" : "Feature"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No videos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
