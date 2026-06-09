import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, Radio, Heart, X, ChevronDown, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer, formatDuration } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import { useFavoriteSong, useUnfavoriteSong, getGetSongQueryKey, useTrackAnalyticsEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

export function Player() {
  const {
    track, isPlaying, currentTime, duration, volume, trackFavorited,
    nowPlayingOpen, isVideoTrack,
    setTrackFavorited, togglePlay, seek, setVolume, setNowPlayingOpen, registerVideoElement,
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

  const handleSkipBack = () => {
    if (!track) return;
    if (currentTime > 3) { seek(0); }
    else { toast({ title: "No previous track", description: "This is the first track in your session." }); }
  };

  const handleSkipForward = () => {
    toast({ title: "No next track", description: "Add songs to a queue to continue playback." });
  };

  const handleVolumeClick = () => setVolume(volume > 0 ? 0 : 0.75);

  return (
    <>
      {/* ── Now Playing Overlay ── */}
      <div
        className={`fixed inset-x-0 bottom-20 z-40 transition-all duration-300 ease-in-out ${
          nowPlayingOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-2xl mx-auto bg-card border border-border/60 rounded-t-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {isVideoTrack ? "Now Playing — Video" : "Now Playing"}
            </span>
            <button
              onClick={() => setNowPlayingOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Close"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5 space-y-4">
            {/* Video element — always in DOM so ref stays assigned */}
            <video
              ref={registerVideoElement}
              playsInline
              className={`w-full rounded-xl bg-black ${isVideoTrack ? "block max-h-64 object-contain" : "hidden"}`}
            />

            {/* Album cover — shown for songs */}
            {!isVideoTrack && (
              <div className="flex justify-center">
                <div className="w-56 h-56 rounded-xl overflow-hidden bg-secondary border border-border/50 shadow-xl flex items-center justify-center">
                  {track?.coverUrl ? (
                    <img src={track.coverUrl} alt={track?.title} className="w-full h-full object-cover" />
                  ) : (
                    <Radio className="w-16 h-16 text-primary/30" />
                  )}
                </div>
              </div>
            )}

            {/* Track info */}
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base leading-tight truncate">{track?.title ?? "—"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-0.5">{track ? <><span className="truncate">{track.artistName}</span><BadgeCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /></> : ""}</p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
                {formatDuration(currentTime)}
              </span>
              <Slider
                value={[progress]}
                max={100}
                step={0.1}
                className="flex-1 h-1"
                onValueChange={([v]) => seek((v / 100) * duration)}
                title={`Seek — ${formatDuration(currentTime)} / ${formatDuration(duration)}`}
              />
              <span className="text-[11px] text-muted-foreground tabular-nums w-8">
                {track ? formatDuration(duration || track.duration || 0) : "0:00"}
              </span>
            </div>

            {/* Controls inside overlay */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleHeartClick}
                disabled={!track}
                className={`transition-colors disabled:opacity-30 ${trackFavorited ? "text-red-500 hover:text-red-400" : "text-muted-foreground hover:text-red-400"}`}
                title={track ? (trackFavorited ? "Remove from favorites" : "Add to favorites") : "No track loaded"}
              >
                <Heart className={`w-5 h-5 transition-all ${trackFavorited ? "fill-current" : ""}`} />
              </button>
              <button
                onClick={handleSkipBack}
                disabled={!track}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                title={track ? (currentTime > 3 ? "Restart track" : "Previous track") : "No track loaded"}
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!track}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center"
                title={!track ? "Select a track" : isPlaying ? "Pause" : "Play"}
              >
                {isPlaying
                  ? <Pause className="w-5 h-5 fill-current" />
                  : <Play className="w-5 h-5 ml-0.5 fill-current" />}
              </button>
              <button
                onClick={handleSkipForward}
                disabled={!track}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                title="Next track"
              >
                <SkipForward className="w-6 h-6" />
              </button>
              <button
                onClick={handleVolumeClick}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Player Bar ── */}
      <div className="h-20 bg-card/95 backdrop-blur border-t border-border/50 w-full flex items-center justify-between px-4 z-50 flex-shrink-0">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          {/* Album art — clickable to open/close Now Playing */}
          <button
            className="w-12 h-12 rounded-md bg-secondary border border-border/50 flex-shrink-0 overflow-hidden shadow-md hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            onClick={() => track && setNowPlayingOpen(!nowPlayingOpen)}
            title={track ? (nowPlayingOpen ? "Close Now Playing" : "Open Now Playing") : undefined}
            disabled={!track}
          >
            {track?.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
                <Radio className="w-4 h-4 text-primary/60" />
              </div>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">
              {track ? track.title : "Select a track"}
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5 leading-tight mt-0.5">
              {track ? <><span className="truncate">{track.artistName}</span><BadgeCheck className="w-3 h-3 text-green-500 flex-shrink-0" /></> : "Everyday Radio"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`flex-shrink-0 w-8 h-8 transition-colors ${track ? (trackFavorited ? "text-red-500 hover:text-red-400" : "text-muted-foreground hover:text-red-400") : "text-muted-foreground/30"}`}
            onClick={handleHeartClick}
            disabled={!track}
            title={track ? (trackFavorited ? "Remove from favorites" : "Add to favorites") : "No track loaded"}
          >
            <Heart className={`w-4 h-4 transition-all ${trackFavorited ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Playback Controls */}
        <div className="flex flex-col items-center gap-1.5 w-[40%] max-w-lg">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              className="text-muted-foreground hover:text-foreground w-8 h-8 disabled:opacity-30"
              onClick={handleSkipBack} disabled={!track}
              title={track ? (currentTime > 3 ? "Restart track" : "Previous track") : "No track loaded"}
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon" onClick={togglePlay} disabled={!track}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform shadow-lg shadow-primary/25 disabled:opacity-50"
              title={!track ? "Select a track to start playing" : isPlaying ? "Pause" : "Play"}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 ml-0.5 fill-current" />}
            </Button>
            <Button
              variant="ghost" size="icon"
              className="text-muted-foreground hover:text-foreground w-8 h-8 disabled:opacity-30"
              onClick={handleSkipForward} disabled={!track}
              title="Next track"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
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
              {track ? formatDuration(duration || track.duration || 0) : "0:00"}
            </span>
          </div>
        </div>

        {/* Volume + Queue */}
        <div className="flex items-center justify-end gap-2 w-[30%]">
          <Button
            variant="ghost" size="icon"
            className="text-muted-foreground hover:text-foreground w-8 h-8"
            title="Queue (coming soon)"
          >
            <ListMusic className="w-4 h-4" />
          </Button>
          <button
            onClick={handleVolumeClick}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
