import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, Radio, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer, formatDuration } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import { useFavoriteSong, useUnfavoriteSong, getGetSongQueryKey, useTrackAnalyticsEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

export function Player() {
  const { track, isPlaying, currentTime, duration, volume, trackFavorited, setTrackFavorited, togglePlay, seek, setVolume } = usePlayer();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const favoriteMutation = useFavoriteSong();
  const unfavoriteMutation = useUnfavoriteSong();
  const trackEvent = useTrackAnalyticsEvent();
  const lastTrackedId = useRef<number | null>(null);

  useEffect(() => {
    if (track && track.id !== lastTrackedId.current) {
      lastTrackedId.current = track.id;
      trackEvent.mutate({
        data: { eventType: "content", eventName: "song_play", contentType: "song", contentId: track.id },
      });
    }
  }, [track?.id]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleHeartClick = () => {
    if (!track) return;
    if (!user) {
      toast({ title: "Sign in to favorite", description: "Create an account to save your favorite tracks." });
      return;
    }
    const next = !trackFavorited;
    setTrackFavorited(next);
    if (next) {
      favoriteMutation.mutate({ id: track.id }, {
        onError: () => { setTrackFavorited(!next); toast({ variant: "destructive", title: "Failed to favorite" }); },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(track.id) });
          trackEvent.mutate({ data: { eventType: "engagement", eventName: "favorite_added", contentType: "song", contentId: track.id } });
        },
      });
    } else {
      unfavoriteMutation.mutate({ id: track.id }, {
        onError: () => { setTrackFavorited(!next); toast({ variant: "destructive", title: "Failed to unfavorite" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(track.id) }),
      });
    }
  };

  return (
    <div className="h-20 bg-card/95 backdrop-blur border-t border-border/50 w-full flex items-center justify-between px-4 z-50 flex-shrink-0">
      {/* Track Info */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        <div className="w-12 h-12 rounded-md bg-secondary border border-border/50 flex-shrink-0 overflow-hidden shadow-md">
          {track?.coverUrl ? (
            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
              <Radio className="w-4 h-4 text-primary/60" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">
            {track ? track.title : "Select a track"}
          </p>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
            {track ? track.artistName : "Everyday Radio"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`flex-shrink-0 w-8 h-8 transition-colors ${track ? (trackFavorited ? "text-red-500 hover:text-red-400" : "text-muted-foreground hover:text-red-400") : "text-muted-foreground/30"}`}
          onClick={handleHeartClick}
          disabled={!track}
        >
          <Heart className={`w-4 h-4 transition-all ${trackFavorited ? "fill-current" : ""}`} />
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
            onClick={togglePlay}
            disabled={!track}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8">
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
            {formatDuration(currentTime)}
          </span>
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            className="flex-1 h-1"
            onValueChange={([v]) => seek((v / 100) * duration)}
          />
          <span className="text-[10px] text-muted-foreground w-8 tabular-nums">
            {track ? formatDuration(duration || track.duration || 0) : "0:00"}
          </span>
        </div>
      </div>

      {/* Volume + Queue */}
      <div className="flex items-center justify-end gap-2 w-[30%]">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8">
          <ListMusic className="w-4 h-4" />
        </Button>
        <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          className="w-20 h-1"
          onValueChange={([v]) => setVolume(v / 100)}
        />
      </div>
    </div>
  );
}
