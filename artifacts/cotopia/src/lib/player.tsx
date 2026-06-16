import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";

export interface Track {
  id: number;
  title: string;
  artistName: string;
  artistId?: number | null;
  artistUserRole?: string | null;
  artistIsVerified?: boolean;
  coverUrl?: string | null;
  streamUrl?: string | null;
  videoUrl?: string | null;
  duration?: number;
  isFavorited?: boolean;
}

export type RepeatMode = "none" | "one" | "all";

interface PlayerContextValue {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  trackFavorited: boolean;
  nowPlayingOpen: boolean;
  isVideoTrack: boolean;
  queue: Track[];
  queueIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  play: (track: Track) => void;
  playAt: (index: number) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  stop: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  setVolume: (v: number) => void;
  setTrackFavorited: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
  registerVideoElement: (el: HTMLVideoElement | null) => void;
  requestPiP: () => Promise<void>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const [trackFavorited, setTrackFavorited] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [queueIndex, setQueueIndexState] = useState(-1);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("none");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const volumeRef = useRef(0.75);
  const videoHandlersRef = useRef<Record<string, EventListener>>({});

  // Refs for stable access inside event handlers (no stale closures)
  const trackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(-1);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("none");

  const setQueue = (q: Track[]) => { queueRef.current = q; setQueueState(q); };
  const setQueueIndex = (i: number) => { queueIndexRef.current = i; setQueueIndexState(i); };

  const getMedia = () =>
    trackRef.current?.videoUrl ? videoElRef.current : audioRef.current;

  const startPlayback = useCallback((t: Track) => {
    const isVideo = !!t.videoUrl;
    if (isVideo && videoElRef.current && t.videoUrl) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      videoElRef.current.src = t.videoUrl;
      videoElRef.current.volume = volumeRef.current;
      videoElRef.current.play().catch(() => {});
      setNowPlayingOpen(true);
    } else if (!isVideo && audioRef.current && t.streamUrl) {
      if (videoElRef.current) { videoElRef.current.pause(); videoElRef.current.src = ""; }
      audioRef.current.src = t.streamUrl;
      audioRef.current.volume = volumeRef.current;
      audioRef.current.play().catch(() => {});
      setNowPlayingOpen(true);
    }
  }, []);

  const loadAndPlay = useCallback((t: Track, newQueueIndex: number) => {
    trackRef.current = t;
    setTrack(t);
    setQueueIndex(newQueueIndex);
    setCurrentTime(0);
    setDuration(t.duration ?? 0);
    setTrackFavorited(t.isFavorited ?? false);
    startPlayback(t);
  }, [startPlayback]);

  // Auto-advance — uses refs so it's always current without re-binding to audio element
  const autoAdvanceRef = useRef<() => void>(() => {});
  useEffect(() => {
    autoAdvanceRef.current = () => {
      const q = queueRef.current;
      const idx = queueIndexRef.current;
      const rep = repeatRef.current;
      const shuf = shuffleRef.current;

      if (rep === "one") {
        const media = getMedia();
        if (media) { media.currentTime = 0; media.play().catch(() => {}); }
        return;
      }

      let nextIdx: number;
      if (shuf && q.length > 1) {
        const others = q.map((_, i) => i).filter(i => i !== idx);
        nextIdx = others[Math.floor(Math.random() * others.length)];
      } else {
        nextIdx = idx + 1;
        if (nextIdx >= q.length) {
          if (rep === "all") nextIdx = 0;
          else { setIsPlaying(false); return; }
        }
      }

      const next = q[nextIdx];
      if (!next) return;
      loadAndPlay(next, nextIdx);
    };
  }, [loadAndPlay]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volumeRef.current;
    audioRef.current = audio;

    const setPlaying = (v: boolean) => {
      setIsPlaying(v);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = v ? 'playing' : 'paused';
    };

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      if ('mediaSession' in navigator && audio.duration && !isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: audio.currentTime });
        } catch {}
      }
    });
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => { setPlaying(false); autoAdvanceRef.current(); });
    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("error", () => setPlaying(false));

    return () => { audio.pause(); audio.src = ""; };
  }, []);

  // Media Session API — action handlers (set once, use refs internally so always current)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => { getMedia()?.play().catch(() => {}); });
    navigator.mediaSession.setActionHandler('pause', () => { getMedia()?.pause(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { autoAdvanceRef.current(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const media = getMedia();
      if (!media) return;
      if (media.currentTime > 3) { media.currentTime = 0; setCurrentTime(0); return; }
      const idx = queueIndexRef.current;
      const prev = queueRef.current[idx - 1];
      if (prev) loadAndPlay(prev, idx - 1);
      else { media.currentTime = 0; setCurrentTime(0); }
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime === undefined) return;
      const media = getMedia();
      if (media) { media.currentTime = details.seekTime; setCurrentTime(details.seekTime); }
    });
  }, [loadAndPlay]);

  // Update Media Session metadata whenever the track changes
  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artistName,
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512' }] : [],
    });
  }, [track?.id]);

  // Stop playback on logout
  useEffect(() => {
    const handleLogout = () => {
      const media = getMedia();
      if (media) { media.pause(); media.currentTime = 0; }
      setIsPlaying(false);
      setTrack(null);
      setQueue([]);
      setQueueIndex(-1);
      trackRef.current = null;
    };
    window.addEventListener("cotopia:logout", handleLogout);
    return () => window.removeEventListener("cotopia:logout", handleLogout);
  }, []);

  const registerVideoElement = useCallback((el: HTMLVideoElement | null) => {
    const old = videoElRef.current;
    if (old) {
      Object.entries(videoHandlersRef.current).forEach(([ev, fn]) => old.removeEventListener(ev, fn));
      old.pause();
    }
    videoElRef.current = el;
    videoHandlersRef.current = {};
    if (!el) return;
    const handlers: Record<string, EventListener> = {
      timeupdate: () => setCurrentTime(el.currentTime),
      durationchange: () => setDuration(el.duration || 0),
      ended: () => { setIsPlaying(false); autoAdvanceRef.current(); },
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      error: () => setIsPlaying(false),
    };
    videoHandlersRef.current = handlers;
    Object.entries(handlers).forEach(([ev, fn]) => el.addEventListener(ev, fn));
  }, []);

  const play = (newTrack: Track) => {
    if (trackRef.current?.id === newTrack.id) {
      const media = getMedia();
      if (!media) return;
      if (!media.paused) { media.pause(); } else { media.play().catch(() => {}); }
      return;
    }

    let q = queueRef.current;
    let idx = q.findIndex(t => t.id === newTrack.id);
    if (idx === -1) {
      q = [...q, newTrack];
      setQueue(q);
      idx = q.length - 1;
    }
    loadAndPlay(newTrack, idx);
  };

  const togglePlay = () => {
    const media = getMedia();
    if (!media || !trackRef.current) return;
    if (!media.paused) { media.pause(); } else { media.play().catch(() => {}); }
  };

  const stop = () => {
    const media = getMedia();
    if (!media) return;
    media.pause();
    media.currentTime = 0;
    setCurrentTime(0);
  };

  const skipNext = useCallback(() => {
    autoAdvanceRef.current();
  }, []);

  const skipPrev = useCallback(() => {
    const media = getMedia();
    if (!media) return;
    if (media.currentTime > 3) {
      media.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (idx <= 0) {
      media.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prev = q[idx - 1];
    if (!prev) return;
    loadAndPlay(prev, idx - 1);
  }, [loadAndPlay]);

  const seek = (time: number) => {
    const media = getMedia();
    if (!media) return;
    media.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (v: number) => {
    volumeRef.current = v;
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (videoElRef.current) videoElRef.current.volume = v;
  };

  const toggleShuffle = () => {
    const v = !shuffleRef.current;
    shuffleRef.current = v;
    setShuffleState(v);
  };

  const cycleRepeat = () => {
    const next: RepeatMode =
      repeatRef.current === "none" ? "one"
      : repeatRef.current === "one" ? "all"
      : "none";
    repeatRef.current = next;
    setRepeatState(next);
  };

  const playAt = useCallback((idx: number) => {
    const q = queueRef.current;
    const t = q[idx];
    if (!t) return;
    loadAndPlay(t, idx);
  }, [loadAndPlay]);

  const addToQueue = (tracks: Track[]) => {
    const q = queueRef.current;
    const existing = new Set(q.map(t => t.id));
    const fresh = tracks.filter(t => !existing.has(t.id));
    setQueue([...q, ...fresh]);
  };

  const removeFromQueue = (index: number) => {
    const q = [...queueRef.current];
    const currentIdx = queueIndexRef.current;
    q.splice(index, 1);
    setQueue(q);
    if (index < currentIdx) {
      setQueueIndex(currentIdx - 1);
    }
  };

  const requestPiP = useCallback(async () => {
    if (!videoElRef.current || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoElRef.current.requestPictureInPicture();
    } catch {}
  }, []);

  return (
    <PlayerContext.Provider value={{
      track, isPlaying, currentTime, duration, volume,
      trackFavorited, nowPlayingOpen,
      isVideoTrack: !!trackRef.current?.videoUrl,
      queue, queueIndex, shuffle, repeat,
      play, playAt, togglePlay, seek, stop, skipNext, skipPrev,
      toggleShuffle, cycleRepeat, addToQueue, removeFromQueue,
      setVolume, setTrackFavorited, setNowPlayingOpen,
      registerVideoElement, requestPiP, audioRef,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
