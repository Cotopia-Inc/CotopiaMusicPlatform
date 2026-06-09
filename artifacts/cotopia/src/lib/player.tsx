import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";

export interface Track {
  id: number;
  title: string;
  artistName: string;
  coverUrl?: string | null;
  streamUrl?: string | null;
  videoUrl?: string | null;
  duration?: number;
  isFavorited?: boolean;
}

interface PlayerContextValue {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  trackFavorited: boolean;
  nowPlayingOpen: boolean;
  isVideoTrack: boolean;
  play: (track: Track) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setTrackFavorited: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
  registerVideoElement: (el: HTMLVideoElement | null) => void;
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const volumeRef = useRef(0.75);
  const videoHandlersRef = useRef<Record<string, EventListener>>({});

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volumeRef.current;
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => setIsPlaying(false));
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("error", () => setIsPlaying(false));

    return () => { audio.pause(); audio.src = ""; };
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
      ended: () => setIsPlaying(false),
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      error: () => setIsPlaying(false),
    };
    videoHandlersRef.current = handlers;
    Object.entries(handlers).forEach(([ev, fn]) => el.addEventListener(ev, fn));
  }, []);

  const getMedia = () => track?.videoUrl ? videoElRef.current : audioRef.current;

  const play = (newTrack: Track) => {
    const isVideo = !!newTrack.videoUrl;
    const audio = audioRef.current;
    const video = videoElRef.current;

    if (track?.id === newTrack.id) {
      const media = getMedia();
      if (!media) return;
      if (isPlaying) { media.pause(); } else { media.play().catch(() => {}); }
      return;
    }

    setTrack(newTrack);
    setTrackFavorited(newTrack.isFavorited ?? false);
    setCurrentTime(0);
    setDuration(newTrack.duration ?? 0);

    if (isVideo && video && newTrack.videoUrl) {
      if (audio) { audio.pause(); audio.src = ""; }
      video.src = newTrack.videoUrl;
      video.volume = volumeRef.current;
      video.play().catch(() => {});
      setNowPlayingOpen(true);
    } else if (!isVideo && audio && newTrack.streamUrl) {
      if (video) { video.pause(); video.src = ""; }
      audio.src = newTrack.streamUrl;
      audio.play().catch(() => {});
    } else {
      setTrack(newTrack);
    }
  };

  const togglePlay = () => {
    const media = getMedia();
    if (!media || !track) return;
    if (isPlaying) { media.pause(); } else { media.play().catch(() => {}); }
  };

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

  return (
    <PlayerContext.Provider value={{
      track, isPlaying, currentTime, duration, volume, trackFavorited, nowPlayingOpen,
      isVideoTrack: !!track?.videoUrl,
      play, togglePlay, seek, setVolume, setTrackFavorited, setNowPlayingOpen,
      registerVideoElement, audioRef,
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
