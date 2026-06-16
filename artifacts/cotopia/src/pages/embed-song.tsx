import { useParams } from "wouter";
import { useGetSong, getGetSongQueryKey } from "@workspace/api-client-react";
import { Play, Radio } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";

export default function EmbedSong() {
  const { id } = useParams();
  const songId = Number(id);

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  if (isLoading) {
    return (
      <div className="h-screen bg-card flex items-center justify-center p-4">
        <Skeleton className="w-full h-20 rounded-xl" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="h-screen bg-card flex items-center justify-center text-muted-foreground text-sm">
        Song not found
      </div>
    );
  }

  return (
    <div className="h-screen bg-card flex items-center p-4">
      <div className="w-full bg-background/80 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-4 p-4">
          {/* Cover */}
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
            {song.coverUrl ? (
              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
                <Radio className="w-5 h-5 text-primary/60" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{song.title}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">{song.artistName}<RoleTag role={song.artistUserRole} size="sm" /></p>
          </div>

          {/* Play */}
          <Button size="icon" className="rounded-full w-10 h-10 bg-primary text-primary-foreground flex-shrink-0" title={`Play ${song.title}`}>
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
          <Slider defaultValue={[0]} max={100} step={1} className="flex-1 h-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Branding */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Everyday Radio</span>
            <span className="text-[9px] text-muted-foreground/60">· Powered by Cotopia</span>
          </div>
          <a
            href={`/songs/${songId}`}
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
