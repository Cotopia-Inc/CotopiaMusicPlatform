import { useParams } from "wouter";
import { useGetPlaylist, getGetPlaylistQueryKey } from "@workspace/api-client-react";
import { Play, Radio, Music, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmbedPlaylist() {
  const { id } = useParams();
  const playlistId = Number(id);

  const { data: playlist, isLoading } = useGetPlaylist(playlistId, {
    query: { enabled: !!playlistId, queryKey: getGetPlaylistQueryKey(playlistId) }
  });

  if (isLoading) {
    return (
      <div className="h-screen bg-card flex items-center justify-center p-4">
        <Skeleton className="w-full h-28 rounded-2xl" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="h-screen bg-card flex items-center justify-center text-muted-foreground text-sm">
        Playlist not found
      </div>
    );
  }

  const firstSong = playlist.songs?.[0];

  return (
    <div className="h-screen bg-card flex items-center p-4">
      <div className="w-full bg-background/80 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-4 p-4">
          {/* Cover / icon */}
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
                <ListMusic className="w-6 h-6 text-primary/60" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{playlist.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {playlist.songCount ?? 0} {playlist.songCount === 1 ? "song" : "songs"}
              {firstSong ? ` · ${firstSong.artistName}` : ""}
            </p>
          </div>

          {/* Play */}
          <Button size="icon" className="rounded-full w-10 h-10 bg-primary text-primary-foreground flex-shrink-0">
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </Button>
        </div>

        {/* Song list preview (up to 3) */}
        {playlist.songs && playlist.songs.length > 0 && (
          <div className="px-4 pb-2 space-y-1 border-t border-border/40 pt-2">
            {playlist.songs.slice(0, 3).map((song, i) => (
              <div key={song.id} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}</span>
                <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-secondary">
                  {song.coverUrl
                    ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music className="w-3 h-3 text-muted-foreground" /></div>}
                </div>
                <p className="text-[11px] truncate flex-1">{song.title}</p>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ))}
            {playlist.songs.length > 3 && (
              <p className="text-[10px] text-muted-foreground pl-6">+{playlist.songs.length - 3} more songs</p>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="px-4 pb-3 pt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
          <Slider defaultValue={[0]} max={100} step={1} className="flex-1 h-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
        </div>

        {/* Branding */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Everyday Radio</span>
            <span className="text-[9px] text-muted-foreground/60">· Powered by Cotopia</span>
          </div>
          <a
            href={`/playlists/${playlistId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline"
          >
            Open →
          </a>
        </div>
      </div>
    </div>
  );
}
