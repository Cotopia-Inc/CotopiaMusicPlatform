import { useParams } from "wouter";
import { Play, Radio, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function EmbedPlaylist() {
  const { id } = useParams();

  return (
    <div className="h-screen bg-card flex items-center p-4">
      <div className="w-full bg-background/80 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-4 p-4">
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center flex-shrink-0">
            <Music className="w-6 h-6 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">Playlist #{id}</p>
            <p className="text-xs text-muted-foreground">Everyday Radio</p>
          </div>
          <Button size="icon" className="rounded-full w-10 h-10 bg-primary text-primary-foreground flex-shrink-0">
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </Button>
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
          <Slider defaultValue={[0]} max={100} step={1} className="flex-1 h-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums">0:00</span>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium">Everyday Radio</span>
            <span className="text-[9px] text-muted-foreground/60">· Powered by Cotopia</span>
          </div>
          <a
            href={`/playlists/${id}`}
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
