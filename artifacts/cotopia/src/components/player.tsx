import { Play, SkipBack, SkipForward, Volume2, Heart, ListMusic, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function Player() {
  return (
    <div className="h-20 bg-card/95 backdrop-blur border-t border-border/50 w-full flex items-center justify-between px-4 z-50 flex-shrink-0">
      {/* Track Info */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        <div className="w-12 h-12 rounded-md bg-secondary border border-border/50 flex-shrink-0 overflow-hidden shadow-md">
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary/60" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">Select a track</p>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">Everyday Radio</p>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary flex-shrink-0 w-8 h-8">
          <Heart className="w-4 h-4" />
        </Button>
      </div>

      {/* Playback Controls */}
      <div className="flex flex-col items-center gap-1.5 w-[40%] max-w-lg">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform shadow-lg shadow-primary/25"
          >
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8">
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">0:00</span>
          <Slider defaultValue={[0]} max={100} step={1} className="flex-1 h-1" />
          <span className="text-[10px] text-muted-foreground w-8 tabular-nums">0:00</span>
        </div>
      </div>

      {/* Volume + Queue */}
      <div className="flex items-center justify-end gap-2 w-[30%]">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8">
          <ListMusic className="w-4 h-4" />
        </Button>
        <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Slider defaultValue={[75]} max={100} step={1} className="w-20 h-1" />
      </div>
    </div>
  );
}
