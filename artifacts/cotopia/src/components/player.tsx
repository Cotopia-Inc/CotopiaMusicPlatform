import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Radio, Heart, ChevronUp, ChevronDown, Shuffle, Repeat, Repeat1, Square,
  Music2, ListMusic, X, Music, GripHorizontal, Maximize2, Minimize2, PictureInPicture2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer, formatDuration } from "@/lib/player";
import { useAuth } from "@/lib/auth";
import { UserLink } from "@/components/user-link";
import {
  useFavoriteSong, useUnfavoriteSong, getGetSongQueryKey, useTrackAnalyticsEvent,
  useRecordSongPlay, useRecordVideoView,
} from "@workspace/api-client-react";
import { AddToPlaylist } from "@/components/add-to-playlist";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState, useCallback } from "react";

function VolumeIcon({ v }: { v: number }) {
  if (v === 0) return <VolumeX className="w-4 h-4" />;
  if (v < 0.4) return <Volume1 className="w-4 h-4" />;
  return <Volume2 className="w-4 h-4" />;
}

export function Player() {
  const {
    track, isPlaying, currentTime, duration, volume,
    trackFavorited, nowPlayingOpen, isVideoTrack,
    queue, queueIndex, shuffle, repeat,
    setTrackFavorited, togglePlay, seek, stop, skipNext, skipPrev,
    toggleShuffle, cycleRepeat, playAt, addToQueue, removeFromQueue,
    setVolume, setNowPlayingOpen, registerVideoElement, requestPiP,
  } = usePlayer();

  const [queueOpen, setQueueOpen] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);

  // Draggable overlay state
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number } | null>(null);
  const [overlayWidth, setOverlayWidth] = useState(440);
  const dragRef = useRef<{ startMx: number; startMy: number; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ startMx: number; startW: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const favoriteMutation = useFavoriteSong();
  const unfavoriteMutation = useUnfavoriteSong();
  const trackEvent = useTrackAnalyticsEvent();
  const recordSongPlay = useRecordSongPlay();
  const recordVideoView = useRecordVideoView();
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
      if (isVideoTrack) {
        recordVideoView.mutate({ id: track.id });
      } else {
        recordSongPlay.mutate({ id: track.id });
      }
    }
  }, [track?.id]);

  // Global mouse events for drag + resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        setOverlayPos({
          x: dragRef.current.startX + (e.clientX - dragRef.current.startMx),
          y: dragRef.current.startY + (e.clientY - dragRef.current.startMy),
        });
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startMx;
        setOverlayWidth(Math.max(300, Math.min(700, resizeRef.current.startW + dx)));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    dragRef.current = { startMx: e.clientX, startMy: e.clientY, startX: rect.left, startY: rect.top };
    e.preventDefault();
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    resizeRef.current = { startMx: e.clientX, startW: overlayWidth };
    e.preventDefault();
    e.stopPropagation();
  }, [overlayWidth]);

  // Update page title so track is visible in background tabs
  useEffect(() => {
    if (track && isPlaying) {
      document.title = `▶ ${track.title} — ${track.artistName} | Everyday Radio`;
    } else if (track) {
      document.title = `⏸ ${track.title} — ${track.artistName} | Everyday Radio`;
    } else {
      document.title = "Everyday Radio by Cotopia";
    }
    return () => { document.title = "Everyday Radio by Cotopia"; };
  }, [track?.id, track?.title, track?.artistName, isPlaying]);

  // Reset position when closing
  const handleClose = () => {
    setNowPlayingOpen(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasPrev = queueIndex > 0 || currentTime > 3;
  const hasNext = queueIndex < queue.length - 1 || repeat === "all" || shuffle;

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

  const overlayStyle: React.CSSProperties = overlayPos
    ? { position: "fixed", left: overlayPos.x, top: overlayPos.y, width: overlayWidth, zIndex: 9999 }
    : { position: "fixed", bottom: 84, right: 16, width: overlayWidth, zIndex: 9999 };

  // ── Now Playing Floating Window ───────────────────────────────────────────
  return (
    <>
      <div
          ref={overlayRef}
          style={{ ...overlayStyle, display: nowPlayingOpen ? undefined : "none" }}
          className="bg-card/98 backdrop-blur-xl border border-border/70 rounded-2xl shadow-2xl overflow-hidden select-none"
        >
          {/* Drag handle / branded header */}
          <div
            onMouseDown={startDrag}
            className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-border/40 cursor-grab active:cursor-grabbing bg-gradient-to-r from-primary/15 via-primary/5 to-black/20"
          >
            <div className="flex items-center gap-2.5">
              <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/40" />
              <Radio className="w-4 h-4 text-primary" />
              <div className="flex flex-col leading-none">
                <span className="text-[11px] font-extrabold tracking-tight text-foreground">Everyday Radio</span>
                <span className="text-[9px] text-muted-foreground tracking-widest uppercase">{isVideoTrack ? "Video" : "Now Playing"}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {isVideoTrack && (
                <>
                  <button
                    onClick={() => requestPiP()}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title="Picture in Picture"
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setVideoExpanded(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={videoExpanded ? "Shrink video" : "Expand video"}
                  >
                    {videoExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Video / Cover art */}
          <div className={isVideoTrack ? "bg-black" : ""}>
            <video
              ref={registerVideoElement}
              playsInline
              className={`w-full bg-black ${isVideoTrack ? "block" : "hidden"}`}
              style={isVideoTrack ? { maxHeight: videoExpanded ? 480 : 260, objectFit: "contain" } : {}}
            />
            {!isVideoTrack && (
              <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
                {track?.coverUrl ? (
                  <>
                    {/* Blurred ambient background */}
                    <img
                      src={track.coverUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-card/20 to-transparent" />
                    {/* Centred album art */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-36 h-36 rounded-xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0">
                        <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                    <Music2 className="w-14 h-14 text-primary/30" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 pb-4 pt-3 space-y-3">
            {/* Track info */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-base leading-tight truncate">{track?.title ?? "—"}</p>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {track ? (
                    <UserLink
                      username={track.artistName}
                      artistId={track.artistId}
                      role={track.artistUserRole}
                      isVerified={track.artistIsVerified}
                      className="text-sm text-muted-foreground"
                      badgeSize="sm"
                      onClick={() => setNowPlayingOpen(false)}
                    />
                  ) : null}
                </div>
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
              {track && !isVideoTrack && (
                <AddToPlaylist songId={track.id} className="text-muted-foreground hover:text-foreground" />
              )}
            </div>

            {/* Progress */}
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

            {/* Main transport controls */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={toggleShuffle}
                className={`transition-colors relative ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={shuffle ? "Shuffle: on" : "Shuffle: off"}
              >
                <Shuffle className="w-5 h-5" />
                {shuffle && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              </button>

              <button
                onClick={skipPrev}
                disabled={!track}
                className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-30"
                title={currentTime > 3 ? "Restart" : "Previous"}
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

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

              <button
                onClick={skipNext}
                disabled={!track || !hasNext}
                className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-30"
                title="Next"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={stop} disabled={!track}
                className="w-7 h-7 rounded bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors disabled:opacity-30"
                title="Stop"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>

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

            {/* Volume row */}
            <div className="flex items-center gap-2 px-1">
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
              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right flex-shrink-0">
                {Math.round(volume * 100)}%
              </span>
              {queue.length > 1 && (
                <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0 ml-1 border-l border-border pl-2">
                  {queueIndex + 1}/{queue.length}
                </span>
              )}
            </div>
          </div>

          {/* Resize grip */}
          <div
            onMouseDown={startResize}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1"
            title="Resize"
          >
            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-muted-foreground/30 rounded-br-sm" />
          </div>
        </div>

      {/* ── Player Bar ─────────────────────────────────────────────────────────── */}
      <div className="h-20 bg-card/95 backdrop-blur border-t border-border/50 w-full flex items-center justify-between px-4 z-50 flex-shrink-0 gap-2">

        {/* Left: track info */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          <button
            className="relative group w-12 h-12 rounded-md bg-secondary border border-border/50 flex-shrink-0 overflow-hidden shadow-md transition-all cursor-pointer"
            onClick={() => track && setNowPlayingOpen(!nowPlayingOpen)}
            disabled={!track}
            title={track ? (nowPlayingOpen ? "Collapse Now Playing" : "Open Now Playing") : undefined}
          >
            {track?.coverUrl
              ? <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary flex items-center justify-center">
                  <Radio className="w-4 h-4 text-primary/60" />
                </div>
              )}
            {track && (
              <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                {nowPlayingOpen
                  ? <ChevronDown className="w-5 h-5 text-white" />
                  : <ChevronUp className="w-5 h-5 text-white" />}
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            {track && (
              <button
                onClick={() => setNowPlayingOpen(!nowPlayingOpen)}
                className={`flex items-center gap-0.5 text-[10px] font-semibold mb-0.5 transition-colors ${
                  nowPlayingOpen ? "text-primary" : "text-primary/50 hover:text-primary"
                }`}
              >
                <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${nowPlayingOpen ? "rotate-180" : ""}`} />
                Now Playing
              </button>
            )}
            <p className="text-sm font-semibold truncate leading-tight">
              {track ? track.title : "Select a track"}
            </p>
            <div className="text-xs text-muted-foreground leading-tight mt-0.5">
              {track ? (
                <UserLink
                  username={track.artistName}
                  artistId={track.artistId}
                  role={track.artistUserRole}
                  isVerified={track.artistIsVerified}
                  className="text-xs text-muted-foreground"
                  badgeSize="sm"
                />
              ) : (
                <span>Everyday Radio</span>
              )}
            </div>
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
          {track && !isVideoTrack && (
            <AddToPlaylist songId={track.id} className="w-8 h-8 text-muted-foreground hover:text-foreground" />
          )}
        </div>

        {/* Centre: controls + progress */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-lg">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              className={`w-8 h-8 relative transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleShuffle}
              title={shuffle ? "Shuffle: on" : "Shuffle: off"}
            >
              <Shuffle className="w-4 h-4" />
              {shuffle && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
            </Button>

            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={skipPrev} disabled={!track}
              title={currentTime > 3 ? "Restart" : "Previous"}
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </Button>

            <Button
              size="icon" onClick={togglePlay} disabled={!track}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
              title={!track ? "Select a track" : isPlaying ? "Pause" : "Play"}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 ml-0.5 fill-current" />}
            </Button>

            <Button
              variant="ghost" size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={skipNext} disabled={!track || !hasNext}
              title="Next"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </Button>

            <Button
              variant="ghost" size="icon"
              className="w-7 h-7 rounded bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors disabled:opacity-30"
              onClick={stop} disabled={!track}
              title="Stop"
            >
              <Square className="w-3 h-3 fill-current" />
            </Button>

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

        {/* Right: queue + volume */}
        <div className="flex items-center justify-end gap-2 w-[30%]">
          <button
            onClick={() => setQueueOpen(v => !v)}
            disabled={!track}
            className={`relative flex-shrink-0 transition-colors disabled:opacity-30 ${
              queueOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
            {queue.length > 1 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center leading-none">
                {queue.length}
              </span>
            )}
          </button>

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

      {/* ── Queue Panel ─────────────────────────────────────────────────────────── */}
      {queueOpen && (
        <div className="fixed bottom-20 right-4 z-30 w-80 flex flex-col" style={{ maxHeight: "calc(100vh - 7rem)" }}>
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Queue</span>
                <span className="text-xs text-muted-foreground">({queue.length} tracks)</span>
              </div>
              <button
                onClick={() => setQueueOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto py-1" style={{ maxHeight: "min(18rem, calc(100vh - 12rem))" }}>
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Music className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Nothing in the queue yet</p>
                </div>
              ) : (
                queue.map((t, idx) => {
                  const isActive = idx === queueIndex;
                  return (
                    <div
                      key={`${t.id}-${idx}`}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        isActive ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground"
                      }`}
                    >
                      <button
                        onClick={() => { playAt(idx); setQueueOpen(false); }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="w-5 text-center flex-shrink-0">
                          {isActive
                            ? <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                            : <span className="text-xs text-muted-foreground">{idx + 1}</span>
                          }
                        </div>
                        <div className="w-9 h-9 rounded bg-secondary overflow-hidden flex-shrink-0 border border-border/40">
                          {t.coverUrl
                            ? <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-muted-foreground/40" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>{t.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.artistName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                          {formatDuration(t.duration ?? 0)}
                        </span>
                      </button>
                      <button
                        onClick={() => removeFromQueue(idx)}
                        className="flex-shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-1 rounded"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
