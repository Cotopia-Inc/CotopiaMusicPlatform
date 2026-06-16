import { useParams, Link, useLocation } from "wouter";
import { UserLink } from "@/components/user-link";
import { useGetPlaylist, getGetPlaylistQueryKey, useUpdatePlaylist, useDeletePlaylist, useRemoveSongFromPlaylist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, ListMusic, ArrowLeft, Share2, Globe, Lock, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const updateMutation = useUpdatePlaylist();
  const deleteMutation = useDeletePlaylist();
  const removeSongMutation = useRemoveSongFromPlaylist();

  const { data: playlist, isLoading } = useGetPlaylist(playlistId, {
    query: { enabled: !!playlistId, queryKey: getGetPlaylistQueryKey(playlistId) }
  });

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

  const handleShare = () => {
    const url = `${window.location.origin}/playlists/${playlistId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTogglePublic = () => {
    updateMutation.mutate(
      { id: playlistId, data: { isPublic: !playlist.isPublic } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) }) }
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
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(playlistId) }),
      onError: () => toast({ variant: "destructive", title: "Failed to remove song" }),
      onSettled: () => setRemovingSongId(null),
    });
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Back navigation */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8 items-end">
        <div className="w-64 h-64 rounded-md shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0 flex items-center justify-center">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-24 h-24 text-muted-foreground opacity-50" />
          )}
        </div>
        <div className="flex-1 space-y-4">
          <p className="text-xs uppercase tracking-widest font-semibold text-primary">Playlist</p>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">{playlist.name}</h1>
          <p className="text-muted-foreground text-sm">{playlist.description}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Created by User {playlist.userId}</span>
            <span>•</span>
            <span>{playlist.songCount} songs</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="icon" className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform" title={`Play ${playlist.name}`} onClick={() => { if (playlist.songs?.[0]) play({ id: playlist.songs[0].id, title: playlist.songs[0].title, artistName: playlist.songs[0].artistName ?? "", artistId: playlist.songs[0].artistId, artistUserRole: (playlist.songs[0] as any).artistUserRole ?? null, artistIsVerified: (playlist.songs[0] as any).artistIsVerified ?? false, coverUrl: playlist.songs[0].coverUrl, streamUrl: playlist.songs[0].streamUrl, duration: playlist.songs[0].duration }); }}>
          <Play className="w-6 h-6 ml-1 fill-current" />
        </Button>

        {/* Share button */}
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleShare}>
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
          {copied ? "Copied!" : "Share"}
        </Button>

        {/* Public / Private toggle — owner only */}
        {isOwner && (
          <Button
            variant={playlist.isPublic ? "secondary" : "outline"}
            size="sm"
            className="gap-2 h-9"
            onClick={handleTogglePublic}
            disabled={updateMutation.isPending}
          >
            {playlist.isPublic ? <Globe className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4" />}
            {playlist.isPublic ? "Public" : "Private"}
          </Button>
        )}

        {/* Public badge for non-owners */}
        {!isOwner && playlist.isPublic && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-green-400" /> Public playlist
          </span>
        )}

        {/* Delete playlist — owner only */}
        {isOwner && !confirmDelete && (
          <Button variant="ghost" size="sm" className="gap-2 h-9 text-red-500/60 hover:text-red-500 hover:bg-red-500/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-4 h-4" /> Delete Playlist
          </Button>
        )}
        {isOwner && confirmDelete && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-xs text-red-400">Delete permanently?</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDeletePlaylist} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Songs List */}
      <div className="space-y-2 max-w-5xl">
        {playlist.songs && playlist.songs.length > 0 ? (
          <>
            <div className="flex items-center gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border/50 uppercase tracking-widest mb-4">
              <span className="w-8">#</span>
              <span className="flex-1">Title</span>
              <span className="w-32 text-right">Duration</span>
            </div>
            {playlist.songs.map((song, idx) => (
              <div
                key={song.id}
                className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors"
                onClick={() => play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: (song as any).artistUserRole ?? null, artistIsVerified: (song as any).artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration })}
              >
                <span className="w-8 text-center text-muted-foreground text-sm group-hover:hidden">{idx + 1}</span>
                <div className="w-8 flex justify-center hidden group-hover:flex">
                  <Play className="w-4 h-4 fill-current text-primary" />
                </div>
                <div className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                  {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{song.title}</div>
                  <UserLink
                    username={song.artistName}
                    artistId={song.artistId}
                    role={(song as any).artistUserRole}
                    isVerified={(song as any).artistIsVerified ?? false}
                    className="text-sm text-muted-foreground truncate"
                  />
                </div>
                <div className="text-muted-foreground text-sm w-32 text-right">
                  {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                </div>
                {isOwner && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveSong(song.id); }}
                    disabled={removingSongId === song.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-8 flex justify-center text-muted-foreground/40 hover:text-red-400 disabled:opacity-30"
                    title="Remove from playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </>
        ) : (
          <p className="text-muted-foreground py-8">This playlist is empty.</p>
        )}
      </div>
    </div>
  );
}
