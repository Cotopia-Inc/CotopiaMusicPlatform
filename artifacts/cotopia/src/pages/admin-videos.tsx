import { useListVideos, getListVideosQueryKey, useUpdateVideo, useDeleteVideo } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Star, Sparkles, EyeOff, Eye, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { UserLink } from "@/components/user-link";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminVideos() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const { data, isLoading } = useListVideos(
    { q: search, limit: 100 },
    { query: { queryKey: getListVideosQueryKey({ q: search, limit: 100 }) } }
  );

  const updateVideo = useUpdateVideo();
  const deleteVideo = useDeleteVideo();

  const patchCache = (id: number, patch: Record<string, unknown>) =>
    queryClient.setQueryData(
      getListVideosQueryKey({ q: search, limit: 100 }),
      (old: any) => old ? { ...old, items: old.items?.map((v: any) => v.id === id ? { ...v, ...patch } : v) } : old
    );

  const handleToggleFeature = (id: number, currentFeatured: boolean | null | undefined) => {
    setPendingId(id);
    updateVideo.mutate(
      { id, data: { isFeatured: !currentFeatured } },
      {
        onSuccess: () => {
          toast({ title: currentFeatured ? "Removed from featured" : "Video featured!" });
          patchCache(id, { isFeatured: !currentFeatured });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update video" }),
        onSettled: () => setPendingId(null),
      }
    );
  };

  const handleTogglePublish = (id: number, currentStatus: string | null | undefined) => {
    const isPublished = currentStatus === "published";
    const newStatus = isPublished ? "unpublished" : "published";
    setPendingId(id);
    updateVideo.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: isPublished ? "Video unpublished" : "Video published!" });
          patchCache(id, { status: newStatus });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update video" }),
        onSettled: () => setPendingId(null),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    deleteVideo.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Video deleted" });
          queryClient.setQueryData(
            getListVideosQueryKey({ q: search, limit: 100 }),
            (old: any) => old ? { ...old, items: old.items?.filter((v: any) => v.id !== id) } : old
          );
          setDeleteTarget(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete video" }),
      }
    );
  };

  return (
    <>
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Video Management</h1>
        <p className="text-muted-foreground">Feature, publish, and manage all videos on the platform.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            aria-label="Search videos"
            placeholder="Search videos..."
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
              data.items.map((video) => {
                const isPublished = video.status === "published";
                const isBusy = pendingId === video.id && updateVideo.isPending;
                return (
                  <TableRow key={video.id} className={!isPublished ? "opacity-60" : ""}>
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
                    <TableCell>
                      <UserLink username={video.artistName ?? ""} artistId={video.artistId} role={video.artistUserRole} isVerified={video.artistIsVerified ?? false} className="text-sm text-muted-foreground" />
                    </TableCell>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            isPublished
                              ? "text-green-400 border-green-500/40 bg-green-500/5"
                              : "text-muted-foreground border-border"
                          }`}
                        >
                          {isPublished ? "Published" : video.status || "Unpublished"}
                        </Badge>
                        {video.isFeatured && (
                          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 border px-1.5">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Publish / Unpublish */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={isPublished ? "Unpublish" : "Publish"}
                              className={`h-8 w-8 ${
                                isPublished
                                  ? "text-muted-foreground hover:text-red-400 hover:border-red-400/40"
                                  : "text-green-400 border-green-500/40 hover:bg-green-500/10"
                              }`}
                              onClick={() => handleTogglePublish(video.id, video.status)}
                              disabled={isBusy}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isPublished ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isPublished ? "Unpublish" : "Publish"}</TooltipContent>
                        </Tooltip>

                        {/* Feature / Unfeature */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={video.isFeatured ? "default" : "outline"}
                              size="icon"
                              aria-label={video.isFeatured ? "Unfeature" : "Feature"}
                              className={`h-8 w-8 ${video.isFeatured ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30 border" : ""}`}
                              onClick={() => handleToggleFeature(video.id, video.isFeatured)}
                              disabled={isBusy}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{video.isFeatured ? "Unfeature" : "Feature"}</TooltipContent>
                        </Tooltip>

                        {/* Issue Strike */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Strike"
                              className="h-8 w-8 text-red-400 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => setStrikeTarget({
                                userId: (video as any).uploaderId ?? (video as any).userId ?? 0,
                                uploaderName: video.artistName ?? "Unknown",
                                contentType: "video",
                                contentId: video.id,
                                contentTitle: video.title,
                              })}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Issue strike</TooltipContent>
                        </Tooltip>

                        {/* Delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Delete video"
                              data-testid={`delete-video-${video.id}`}
                              className="h-8 w-8 text-red-500 border-red-500/40 hover:bg-red-500/15 hover:text-red-400"
                              onClick={() => setDeleteTarget({ id: video.id, title: video.title })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete video</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
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
    </div>

    <CopyrightStrikeModal
      target={strikeTarget}
      onClose={() => setStrikeTarget(null)}
    />

    <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this video?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget && <>"{deleteTarget.title}" will be permanently removed. This action cannot be undone.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteVideo.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleteVideo.isPending} className="bg-destructive hover:bg-destructive/90">
            {deleteVideo.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
