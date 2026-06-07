import { useParams, Link } from "wouter";
import { useGetPlaylist, getGetPlaylistQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, ListMusic, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlaylistDetail() {
  const { id } = useParams();
  const playlistId = Number(id);

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

  return (
    <div className="space-y-12 pb-24">
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
      <div className="flex items-center gap-6">
        <Button size="icon" className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform">
          <Play className="w-6 h-6 ml-1 fill-current" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="w-8 h-8" />
        </Button>
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
              <Link key={song.id} href={`/songs/${song.id}`}>
                <div className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors">
                  <span className="w-8 text-center text-muted-foreground text-sm group-hover:hidden">{idx + 1}</span>
                  <div className="w-8 flex justify-center hidden group-hover:flex">
                    <Play className="w-4 h-4 fill-current text-primary" />
                  </div>
                  <div className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{song.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{song.artistName}</div>
                  </div>
                  <div className="text-muted-foreground text-sm w-32 text-right">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </Link>
            ))}
          </>
        ) : (
          <p className="text-muted-foreground py-8">This playlist is empty.</p>
        )}
      </div>
    </div>
  );
}
