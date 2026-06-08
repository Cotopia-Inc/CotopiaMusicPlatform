import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react";

export interface Track {
  id: number;
  title: string;
  artistName: string;
  coverUrl?: string | null;
  streamUrl?: string | null;
  duration?: number;
}

interface PlayerState {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

interface PlayerContextValue extends PlayerState {
  play: (track: Track) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => setIsPlaying(false));
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => { audio.pause(); audio.src = ""; };
  }, []);

  const play = (newTrack: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (track?.id === newTrack.id) {
      if (isPlaying) { audio.pause(); } else { audio.play(); }
      return;
    }
    setTrack(newTrack);
    setCurrentTime(0);
    audio.src = newTrack.streamUrl ?? "";
    audio.load();
    if (newTrack.streamUrl) {
      audio.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (isPlaying) { audio.pause(); } else { audio.play().catch(() => {}); }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <PlayerContext.Provider value={{ track, isPlaying, currentTime, duration, volume, play, togglePlay, seek, setVolume, audioRef }}>
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
