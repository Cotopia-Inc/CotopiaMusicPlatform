import { Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function Player() {
  return (
    <div className="h-24 bg-card border-t border-border w-full flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-4 w-1/3">
        <div className="w-14 h-14 bg-muted rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-secondary"></div>
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm cursor-pointer hover:underline">Select a track</span>
          <span className="text-xs text-muted-foreground cursor-pointer hover:underline">Various Artists</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-1/3 gap-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button size="icon" className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform">
            <Play className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
        <div className="w-full flex items-center gap-2 max-w-md">
          <span className="text-xs text-muted-foreground w-10 text-right">0:00</span>
          <Slider defaultValue={[0]} max={100} step={1} className="w-full" />
          <span className="text-xs text-muted-foreground w-10">0:00</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 w-1/3">
        <Volume2 className="w-5 h-5 text-muted-foreground" />
        <Slider defaultValue={[80]} max={100} step={1} className="w-24" />
      </div>
    </div>
  );
}
