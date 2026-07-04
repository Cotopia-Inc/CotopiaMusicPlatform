import { useParams, Link, useLocation } from "wouter";
import { UserLink } from "@/components/user-link";
import {
  useGetPlaylist, getGetPlaylistQueryKey, useUpdatePlaylist, useDeletePlaylist,
  useRemoveSongFromPlaylist, useReorderPlaylistSongs,
  type Song,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play, ListMusic, ArrowLeft, Share2, Globe, Lock, Check, Trash2,
  Pencil, GripVertical, X, Upload, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/lib/useUpload";
import { ImageCropModal } from "@/components/image-crop-modal";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Sortable song row ───────────────────────────────────────────────────────

interface SortableSongRowProps {
  song: {
    id: number;
    title: string;
    artistName?: string | null;
    artistId?: number | null;
    artistUserRole?: string | null;
    artistIsVerified?: boolean;
    coverUrl?: string | null;
    streamUrl?: string;
    duration: number;
  };
  index: number;
  isOwner: boolean;
  editMode: boolean;
  isRemoving: boolean;
  onPlay: () => void;
  onRemove: () => void;
}

function SortableSongRow({
  song, index, isOwner, editMode, isRemoving, onPlay, onRemove,
}: SortableSongRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 rounded-md group cursor-pointer transition-colors ${
        isDragging ? "bg-secondary shadow-lg" : "hover:bg-secondary/50"
      }`}
    >
      {/* Drag handle — only in edit mode */}
      {editMode && isOwner ? (
        <button
          {...attributes}
          {...listeners}
          className="w-8 flex justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <>
          <span className="w-8 text-center text-muted-foreground text-sm group-hover:hidden">{index + 1}</span>
          <div className="w-8 flex justify-center hidden group-hover:flex" onClick={onPlay}>
            <Play className="w-4 h-4 fill-current text-primary" />
          </div>
        </>
      )}

      <div
        className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0"
        onClick={editMode ? undefined : onPlay}
      >
        {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />}
      </div>

      <div className="flex-1 min-w-0" onClick={editMode ? undefined : onPlay}>
        <div className="font-medium truncate">{song.title}</div>
        <UserLink
          username={song.artistName ?? ""}
          artistId={song.artistId}
          role={song.artistUserRole}
          isVerified={song.artistIsVerified ?? false}
          className="text-sm text-muted-foreground truncate"
        />
      </div>

      <div className="text-muted-foreground text-sm w-32 text-right" onClick={editMode ? undefined : onPlay}>
        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, "0")}
      </div>

      {isOwner && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={isRemoving}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 flex justify-center text-muted-foreground/40 hover:text-red-400 disabled:opacity-30"
          title="Remove from playlist"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PlaylistDetail() {
  const { id } = useParams();
  const playlistId = Number(id);
  const { play } = usePlayer();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdatePlaylist();
  const deleteMutation = useDeletePlaylist();
  const removeSongMutation = useRemoveSongFromPlaylist();
  const reorderMutation = useReorderPlaylistSongs();
  const coverUpload = useUpload({
    onSuccess: (res) => setEditCoverUrl(`/api/storage${res.objectPath}`),
    onError: (err) => toast({ variant: "destructive", title: "Cover upload failed", description: err.message }),
  });
  const [coverCropUrl, setCoverCropUrl] = useState<string | null>(null);
  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCoverCropUrl(URL.createObjectURL(f));
    e.target.value = "";
  };
  const handleCoverCropConfirm = async (blob: Blob) => {
    if (coverCropUrl) URL.revokeObjectURL(coverCropUrl);
    setCoverCropUrl(null);
    await coverUpload.uploadFile(new File([blob], "cover.jpg", { type: "image/jpeg" }));
  };

  const { data: playlist, isLoading } = useGetPlaylist(playlistId, {
    query: { enabled: !!playlistId, queryKey: getGetPlaylistQueryKey(playlistId) },
  });

  // Sync local songs when playlist loads / changes (but not while dragging)
  useEffect(() => {
    if (playlist?.songs) setLocalSongs(playlist.songs as typeof localSongs);
  }, [playlist?.songs]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <div className="flex gap-8 items-end h-64">
          <Skeleton className="w-64 h-64 rounded-md" />
          <div className="space-y-4 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) return <div className="p-8 text-center text-muted-foreground">Playlist not found</div>;

  const isOwner = user && playlist.userId === user.id;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenEdit = () => {
    setEditName(playlist.name);
    setEditDescription(playlist.description ?? "");
    setEditCoverUrl(playlist.coverUrl ?? "");
    setEditIsPublic(playlist.isPublic);
    setLocalSongs((playlist.songs ?? []) as typeof localSongs);
    setOrderDirty(false);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setOrderDirty(false);
    setLocalSongs((playlist.songs ?? []) as typeof localSongs);
  };

  const handleSaveEdit = async () => {
    const updates: Record<string, unknown> = {};
    if (editName.trim() !== playlist.name) updates.name = editName.trim();
    if (editDescription !== (playlist.description ?? "")) updates.description = editDescription;
    if (editCoverUrl !== (playlist.coverUrl ?? "")) updates.coverUrl = editCoverUrl;
    if (editIsPublic !== playlist.isPublic) updates.isPublic = editIsPublic;

    const saveMetadata = Object.keys(updates).length > 0
      ? updateMutation.mutateAsync({ id: playlistId, data: updates as Parameters<typeof updateMutation.mutate>[0]["data"] })
      : Promise.resolve();

    const saveOrder = orderDirty && localSongs && localSongs.length > 0
      ? reorderMutation.mutateAsync({ id: playlistId, data: { songIds: localSongs.map((s) => s!.id) } })
      : Promise.resolve();

    try {
      await Promise.all([saveMetadata, saveOrder]);
      await queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) });
      setEditMode(false);
      setOrderDirty(false);
      toast({ title: "Playlist saved" });
    } catch {
      toast({ variant: "destructive", title: "Failed to save changes" });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/playlists/${playlistId}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTogglePublic = () => {
    if (editMode) { setEditIsPublic((v) => !v); return; }
    updateMutation.mutate(
      { id: playlistId, data: { isPublic: !playlist.isPublic } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) }) },
    );
  };

  const handleDeletePlaylist = () => {
    deleteMutation.mutate({ id: playlistId }, {
      onSuccess: () => { toast({ title: "Playlist deleted" }); navigate("/library"); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete playlist" }),
    });
  };

  const handleRemoveSong = (songId: number) => {
    setRemovingSongId(songId);
    removeSongMutation.mutate({ id: playlistId, songId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) });
        setLocalSongs((prev) => (prev ?? []).filter((s) => s?.id !== songId));
      },
      onError: () => toast({ variant: "destructive", title: "Failed to remove song" }),
      onSettled: () => setRemovingSongId(null),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalSongs((items) => {
        const ids = (items ?? []).map((s) => s?.id);
        const oldIndex = ids.indexOf(Number(active.id));
        const newIndex = ids.indexOf(Number(over.id));
        return arrayMove(items ?? [], oldIndex, newIndex);
      });
      setOrderDirty(true);
    }
  };

  const isSaving = updateMutation.isPending || reorderMutation.isPending;
  const displayedSongs = editMode ? localSongs : playlist.songs;
  const currentIsPublic = editMode ? editIsPublic : playlist.isPublic;
  const currentCover = editMode ? editCoverUrl : playlist.coverUrl;

  return (
    <div className="space-y-12 pb-24">
      {/* Back */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 items-end">
        {/* Cover image */}
        <div className="relative w-44 h-44 md:w-64 md:h-64 rounded-md shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0 flex items-center justify-center group">
          {currentCover ? (
            <img src={currentCover} alt={editMode ? editName : playlist.name} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-24 h-24 text-muted-foreground opacity-50" />
          )}

          {/* Upload overlay in edit mode */}
          {editMode && isOwner && (
            <>
              <div
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverUpload.isUploading ? (
                  <>
                    <div className="w-24 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${coverUpload.progress}%` }} />
                    </div>
                    <span className="text-white text-xs">{coverUpload.progress}%</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-white" />
                    <span className="text-white text-xs font-medium">Change cover</span>
                  </>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFile}
              />
              {currentCover && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditCoverUrl(""); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black transition-colors"
                  title="Remove cover"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Info / edit fields */}
        <div className="flex-1 space-y-4 min-w-0">
          <p className="text-xs uppercase tracking-widest font-semibold text-primary">Playlist</p>

          {editMode && isOwner ? (
            <input
              className="text-3xl md:text-5xl font-extrabold tracking-tighter bg-transparent border-b border-border/60 focus:border-primary outline-none w-full pb-1 transition-colors"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Playlist name"
              maxLength={120}
            />
          ) : (
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter">{playlist.name}</h1>
          )}

          {editMode && isOwner ? (
            <textarea
              className="text-sm text-muted-foreground bg-transparent border border-border/40 focus:border-primary outline-none w-full rounded-md px-3 py-2 resize-none transition-colors"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add a description…"
              maxLength={500}
            />
          ) : (
            playlist.description && <p className="text-muted-foreground text-sm">{playlist.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {playlist.songCount} {playlist.songCount === 1 ? "song" : "songs"}
            </span>
            {orderDirty && <span className="text-xs text-primary/70">(unsaved order)</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {!editMode && (
          <Button
            size="icon"
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
            title={`Play ${playlist.name}`}
            onClick={() => {
              const first = playlist.songs?.[0];
              if (first) play({
                id: first.id, title: first.title, artistName: first.artistName ?? "",
                artistId: first.artistId, artistUserRole: (first as any).artistUserRole ?? null,
                artistIsVerified: (first as any).artistIsVerified ?? false,
                coverUrl: first.coverUrl, streamUrl: first.streamUrl, duration: first.duration,
              });
            }}
          >
            <Play className="w-6 h-6 ml-1 fill-current" />
          </Button>
        )}

        {/* Edit toggle — owner only */}
        {isOwner && !editMode && (
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleOpenEdit}>
            <Pencil className="w-4 h-4" /> Edit
          </Button>
        )}

        {/* Save / Cancel in edit mode */}
        {editMode && isOwner && (
          <>
            <Button size="sm" className="gap-2 h-9" onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" size="sm" className="h-9" onClick={handleCancelEdit} disabled={isSaving}>
              Cancel
            </Button>
          </>
        )}

        {/* Share */}
        {!editMode && (
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleShare}>
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? "Copied!" : "Share"}
          </Button>
        )}

        {/* Public/Private toggle */}
        {isOwner && (
          <Button
            variant={currentIsPublic ? "secondary" : "outline"}
            size="sm"
            className="gap-2 h-9"
            onClick={handleTogglePublic}
            disabled={!editMode && updateMutation.isPending}
          >
            {currentIsPublic ? <Globe className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4" />}
            {currentIsPublic ? "Public" : "Private"}
          </Button>
        )}

        {/* Public badge for non-owners */}
        {!isOwner && playlist.isPublic && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-green-400" /> Public playlist
          </span>
        )}

        {/* Delete — owner only, not in edit mode */}
        {isOwner && !editMode && !confirmDelete && (
          <Button
            variant="ghost" size="sm"
            className="gap-2 h-9 text-red-500/60 hover:text-red-500 hover:bg-red-500/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        )}
        {isOwner && !editMode && confirmDelete && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-xs text-red-400">Delete permanently?</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDeletePlaylist} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Edit hint */}
      {editMode && isOwner && (displayedSongs?.length ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" />
          Drag rows to reorder songs. Hover a song to remove it.
        </p>
      )}

      {/* Songs list */}
      <div className="space-y-2 max-w-5xl">
        {displayedSongs && displayedSongs.length > 0 ? (
          <>
            <div className="flex items-center gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border/50 uppercase tracking-widest mb-4">
              <span className="w-8">{editMode ? "" : "#"}</span>
              <span className="flex-1">Title</span>
              <span className="w-32 text-right">Duration</span>
              {isOwner && <span className="w-8" />}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={(displayedSongs ?? []).map((s) => s!.id)}
                strategy={verticalListSortingStrategy}
              >
                {(displayedSongs ?? []).map((song, idx) => (
                  <SortableSongRow
                    key={song!.id}
                    song={song as any}
                    index={idx}
                    isOwner={!!isOwner}
                    editMode={editMode}
                    isRemoving={removingSongId === song!.id}
                    onPlay={() => play({
                      id: song!.id, title: song!.title, artistName: song!.artistName ?? "",
                      artistId: song!.artistId,
                      artistUserRole: (song as any).artistUserRole ?? null,
                      artistIsVerified: (song as any).artistIsVerified ?? false,
                      coverUrl: song!.coverUrl, streamUrl: song!.streamUrl, duration: song!.duration,
                    })}
                    onRemove={() => handleRemoveSong(song!.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <p className="text-muted-foreground py-8">This playlist is empty.</p>
        )}
      </div>
      {coverCropUrl && (
        <ImageCropModal
          imageUrl={coverCropUrl}
          aspectRatio={1}
          title="Crop Playlist Cover"
          outputSize={800}
          onConfirm={handleCoverCropConfirm}
          onCancel={() => { URL.revokeObjectURL(coverCropUrl); setCoverCropUrl(null); }}
        />
      )}
    </div>
  );
}
