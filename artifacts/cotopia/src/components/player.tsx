import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Radio, Heart, ChevronDown, Shuffle, Repeat, Repeat1, Square, Music2, StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer, formatDuration } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import {
  useFavoriteSong, useUnfavoriteSong, getGetSongQueryKey, useTrackAnalyticsEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────

function VolumeIcon({ v }: { v: number }) {
  if (v === 0) return <VolumeX className="w-4 h-4" />;
  if (v < 0.4) return <Volume1 className="w-4 h-4" />;
  return <Volume2 className="w-4 h-4" />;
}

// ── main component ────────────────────────────────────────────────────────────

export function Player() {
  const {
    track, isPlaying, currentTime, duration, volume,
    trackFavorited, nowPlayingOpen, isVideoTrack,
    queue, queueIndex, shuffle, repeat,
    setTrackFavorited, togglePlay, seek, stop, skipNext, skipPrev,
    toggleShuffle, cycleRepeat,
    setVolume, setNowPlayingOpen, registerVideoElement,
  } = usePlayer();

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
        data: {
          eventType: "content", eventName: "song_play",
          contentType: "song", contentId: track.id,
        },
      });
    }
  }, [track?.id]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const hasPrev = queueIndex > 0 || currentTime > 3;
  const hasNext =
    queueIndex < queue.length - 1 || repeat === "all" || shuffle;

  const handleHeartClick = () => {
    if (!track) return;
    if (!user) {
      toast({ title: "Sign in to favorite", description: "Create an account to save your favourite tracks." });
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

  const handleVolumeClick = () => setVolume(volume > 0 ? 0 : 0.75);

  const repeatTitle =
    repeat === "none" ? "Repeat: off" :
    repeat === "one"  ? "Repeat: one" :
                        "Repeat: all";

  // ── Now Playing Overlay ──────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-20 z-40 transition-all duration-300 ease-in-out ${
          nowPlayingOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-lg mx-auto bg-card border border-border/60 rounded-t-2xl shadow-2xl overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {isVideoTrack ? "Now Playing — Video" : "Now Playing"}
            </span>
            <button
              onClick={() => setNowPlayingOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Collapse"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* video / cover art */}
          <div className="px-5">
            <video
              ref={registerVideoElement}
              playsInline
              className={`w-full rounded-xl bg-black ${isVideoTrack ? "block max-h-64 object-contain" : "hidden"}`}
            />
            {!isVideoTrack && (
              <div className="flex justify-center pb-1">
                <div className="w-52 h-52 rounded-xl overflow-hidden bg-secondary border border-border/50 shadow-xl flex items-center justify-center">
                  {track?.coverUrl
                    ? <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                    : <Music2 className="w-14 h-14 text-primary/30" />}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 space-y-3">
            {/* track info */}
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="min-w-0">
                <p className="font-bold text-base leading-tight truncate">{track?.title ?? "—"}</p>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{track?.artistName ?? ""}</p>
              </div>
              <button
                onClick={handleHeartClick}
                disabled={!track}
                className={`flex-shrink-0 transition-all disabled:opacity-30 ${
                  trackFavorited ? "text-red-500 hover:text-red-400 scale-110" : "text-muted-foreground hover:text-red-400"
                }`}
                title={trackFavorited ? "Remove from favourites" : "Add to favourites"}
              >
                <Heart className={`w-5 h-5 transition-all ${trackFavorited ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* progress */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground tabular-nums w-9 text-right">
                {formatDuration(currentTime)}
              </span>
              <Slider
                value={[progress]} max={100} step={0.1} className="flex-1"
                onValueChange={([v]) => seek((v / 100) * duration)}
                title={`Seek — ${formatDuration(currentTime)} / ${formatDuration(duration)}`}
              />
              <span className="text-[11px] text-muted-foreground tabular-nums w-9">
                {formatDuration(duration || track?.duration || 0)}
              </span>
            </div>

            {/* main controls */}
            <div className="flex items-center justify-between px-2">
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                className={`transition-colors relative ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={shuffle ? "Shuffle: on" : "Shuffle: off"}
              >
                <Shuffle className="w-5 h-5" />
                {shuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              </button>

              {/* Skip back */}
              <button
                onClick={skipPrev}
                disabled={!track}
                className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-30"
                title={currentTime > 3 ? "Restart" : "Previous"}
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                disabled={!track}
                className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying
                  ? <Pause className="w-6 h-6 fill-current" />
                  : <Play className="w-6 h-6 ml-0.5 fill-current" />}
              </button>

              {/* Skip forward */}
              <button
                onClick={skipNext}
                disabled={!track || !hasNext}
                className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-30"
                title="Next"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              {/* Repeat */}
              <button
                onClick={cycleRepeat}
                className={`transition-colors relative ${repeat !== "none" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={repeatTitle}
              >
                {repeat === "one"
                  ? <Repeat1 className="w-5 h-5" />
                  : <Repeat className="w-5 h-5" />}
                {repeat !== "none" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              </button>
            </div>

            {/* secondary controls: stop + volume */}
            <div className="flex items-center gap-3 px-1">
              <button
                onClick={stop}
                disabled={!track}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 flex-shrink-0"
                title="Stop"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={handleVolumeClick}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                <VolumeIcon v={volume} />
              </button>
              <Slider
                value={[volume * 100]} max={100} step={1} className="flex-1"
                onValueChange={([v]) => setVolume(v / 100)}
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
              {queue.length > 1 && (
                <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                  {queueIndex + 1} / {queue.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Player Bar ─────────────────────────────────────────────────────────── */}
      <div className="h-20 bg-card/95 backdrop-blur border-t border-border/50 w-full flex items-center justify-between px-4 z-50 flex-shrink-0 gap-2">

        {/* Left: track info */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          <button
            className="w-12 h-12 rounded-md bg-secondary border border-border/50 flex-shrink-0 overflow-hidden shadow-md hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            onClick={() => track && setNowPlayingOpen(!nowPlayingOpen)}
            disabled={!track}
            title={track ? (nowPlayingOpen ? "Collapse" : "Expand") : undefined}
          >
            {track?.coverUrl
              ? <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
                  <Radio className="w-4 h-4 text-primary/60" />
                </div>
              )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight">
              {track ? track.title : "Select a track"}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {track ? track.artistName : "Everyday Radio"}
            </p>
          </div>
          <Button
            variant="ghost" size="icon"
            className={`flex-shrink-0 w-8 h-8 transition-all ${
              track
                ? trackFavorited
                  ? "text-red-500 hover:text-red-400 scale-110"
                  : "text-muted-foreground hover:text-red-400"
                : "text-muted-foreground/30"
            }`}
            onClick={handleHeartClick}
            disabled={!track}
            title={trackFavorited ? "Remove from favourites" : "Add to favourites"}
          >
            <Heart className={`w-4 h-4 transition-all ${trackFavorited ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Centre: controls + progress */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-lg">
          <div className="flex items-center gap-1">
            {/* Shuffle */}
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 relative transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleShuffle}
              title={shuffle ? "Shuffle: on" : "Shuffle: off"}
            >
              <Shuffle className="w-4 h-4" />
              {shuffle && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
            </Button>

            {/* Skip back */}
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={skipPrev} disabled={!track}
              title={currentTime > 3 ? "Restart" : "Previous"}
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </Button>

            {/* Play / Pause */}
            <Button
              size="icon" onClick={togglePlay} disabled={!track}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
              title={!track ? "Select a track" : isPlaying ? "Pause" : "Play"}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 ml-0.5 fill-current" />}
            </Button>

            {/* Skip forward */}
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={skipNext} disabled={!track || !hasNext}
              title="Next"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </Button>

            {/* Stop */}
            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={stop} disabled={!track}
              title="Stop"
            >
              <StopCircle className="w-4 h-4" />
            </Button>

            {/* Repeat */}
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 relative transition-colors ${repeat !== "none" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={cycleRepeat}
              title={repeatTitle}
            >
              {repeat === "one"
                ? <Repeat1 className="w-4 h-4" />
                : <Repeat className="w-4 h-4" />}
              {repeat !== "none" && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
            </Button>
          </div>

          {/* Progress bar */}
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <Slider
              value={[progress]} max={100} step={0.1} className="flex-1 h-1"
              onValueChange={([v]) => seek((v / 100) * duration)}
              title={track ? `Seek — ${formatDuration(currentTime)} / ${formatDuration(duration)}` : "No track loaded"}
            />
            <span className="text-[10px] text-muted-foreground w-8 tabular-nums">
              {formatDuration(duration || track?.duration || 0)}
            </span>
          </div>
        </div>

        {/* Right: volume */}
        <div className="flex items-center justify-end gap-2 w-[30%]">
          {queue.length > 1 && (
            <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:block">
              {queueIndex + 1}/{queue.length}
            </span>
          )}
          <button
            onClick={handleVolumeClick}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            <VolumeIcon v={volume} />
          </button>
          <Slider
            value={[volume * 100]} max={100} step={1} className="w-20 h-1"
            onValueChange={([v]) => setVolume(v / 100)}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      </div>
    </>
  );
}
