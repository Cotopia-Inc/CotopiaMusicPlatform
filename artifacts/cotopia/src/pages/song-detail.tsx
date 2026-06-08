import { useParams } from "wouter";
import {
  useGetSong, getGetSongQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateSong, useFavoriteSong, useUnfavoriteSong,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, Heart, Star, Send, Radio, Users, BadgeCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function SongDetail() {
  const { id } = useParams();
  const songId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  const { data: chatMessages, isLoading: loadingChat } = useGetChatMessages("song", songId, {}, {
    query: { enabled: !!songId, queryKey: getGetChatMessagesQueryKey("song", songId) }
  });

  const [chatInput, setChatInput] = useState("");
  const [localFavorited, setLocalFavorited] = useState<boolean | null>(null);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { play: playerPlay, isPlaying, track: currentTrack } = usePlayer();
  const isThisSongPlaying = isPlaying && currentTrack?.id === songId;

  const postChatMutation = usePostChatMessage();
  const rateMutation = useRateSong();
  const favoriteMutation = useFavoriteSong();
  const unfavoriteMutation = useUnfavoriteSong();

  const isFavorited = localFavorited ?? song?.isFavorited ?? false;
  const userRating = localRating ?? song?.userRating ?? null;
  const listenCount = useRef(Math.floor(Math.random() * 200) + 12).current;

  useEffect(() => {
    if (song) {
      setLocalFavorited(song.isFavorited ?? false);
      setLocalRating(song.userRating ?? null);
    }
  }, [song?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages?.length]);

  const handleToggleFavorite = () => {
    if (!user) {
      toast({ title: "Sign in to favorite", description: "Create an account to save your favorite tracks." });
      return;
    }
    const next = !isFavorited;
    setLocalFavorited(next);
    if (next) {
      favoriteMutation.mutate({ id: songId }, {
        onError: () => { setLocalFavorited(!next); toast({ variant: "destructive", title: "Failed to favorite" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) }),
      });
    } else {
      unfavoriteMutation.mutate({ id: songId }, {
        onError: () => { setLocalFavorited(!next); toast({ variant: "destructive", title: "Failed to unfavorite" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) }),
      });
    }
  };

  const handleRate = (star: number) => {
    if (!user) {
      toast({ title: "Sign in to rate", description: "Create an account to rate tracks." });
      return;
    }
    const newRating = userRating === star ? 0 : star;
    setLocalRating(newRating === 0 ? null : newRating);
    rateMutation.mutate({ id: songId, data: { rating: newRating } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) }),
      onError: () => {
        setLocalRating(userRating);
        toast({ variant: "destructive", title: "Failed to rate" });
      },
    });
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    postChatMutation.mutate({ contentType: "song", contentId: songId, data: { message: chatInput } }, {
      onSuccess: () => {
        setChatInput("");
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey("song", songId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <div className="flex gap-8 items-end">
          <Skeleton className="w-56 h-56 rounded-xl" />
          <div className="space-y-4 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!song) return <div className="p-8 text-center text-muted-foreground">Song not found</div>;

  return (
    <div className="flex gap-6 pb-24 h-full">
      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-8 items-end">
          <div className="w-56 h-56 rounded-xl shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0">
            {song.coverUrl ? (
              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary">
                <Radio className="w-12 h-12 text-primary/40" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-primary/30 text-primary">Song</Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-none">{song.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <Link href={`/artists/${song.artistId}`}>
                <span className="font-semibold text-foreground hover:text-primary cursor-pointer transition-colors flex items-center gap-1">
                  {song.artistName}
                  <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                </span>
              </Link>
              {song.albumName && <><span>•</span><span>{song.albumName}</span></>}
              <span>•</span>
              <span>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
              <span>•</span>
              <span>{song.playCount?.toLocaleString() || 0} plays</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            size="icon"
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform shadow-lg shadow-primary/30"
            onClick={() => song && playerPlay({ id: song.id, title: song.title, artistName: song.artistName ?? "", coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration })}
          >
            {isThisSongPlaying
              ? <Pause className="w-6 h-6 fill-current" />
              : <Play className="w-6 h-6 ml-0.5 fill-current" />}
          </Button>

          {/* Heart toggle */}
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-full transition-all hover:scale-110 ${isFavorited ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`w-7 h-7 transition-all ${isFavorited ? "fill-current" : ""}`} />
          </button>

          {/* Star rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                className="p-0.5 hover:scale-125 transition-transform"
                title={userRating === star ? "Click to clear rating" : `Rate ${star} stars`}
              >
                <Star className={`w-5 h-5 transition-colors ${userRating && userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/40 hover:text-primary'}`} />
              </button>
            ))}
            <span className="text-sm text-muted-foreground ml-2 tabular-nums">
              {song.avgRating ? song.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {song.genre && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{song.genre}</Badge>
          </div>
        )}
      </div>

      {/* ── Chat Panel ── */}
      <div
        className="w-80 flex-shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden"
        style={{ height: "calc(100vh - 11rem)" }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-card/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold">Fan Chat</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{listenCount} listening</span>
          </div>
        </div>

        {/* Now Playing strip */}
        {song && (
          <div className="px-3 py-2 border-b border-border/50 bg-primary/5 flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-secondary">
              {song.coverUrl
                ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate leading-tight">{song.title}</p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">{song.artistName}</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {loadingChat ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </div>
            ))
          ) : chatMessages?.length ? (
            <>
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex gap-2 group">
                  <div className="w-7 h-7 rounded-full bg-primary/20 overflow-hidden flex-shrink-0 text-xs flex items-center justify-center font-bold text-primary">
                    {msg.avatarUrl
                      ? <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                      : msg.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-foreground">{msg.username}</span>
                      <span className="text-[10px] text-muted-foreground/60">{formatTime(msg.createdAt)}</span>
                    </div>
                    <div className="bg-secondary/60 rounded-lg px-3 py-2 mt-0.5">
                      <p className="text-xs leading-relaxed break-words text-foreground/90">{msg.message}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/60">No messages yet</p>
                <p className="text-xs text-muted-foreground mt-1">Be the first to start the conversation</p>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border bg-card/80 flex-shrink-0">
          {user ? (
            <form onSubmit={handleChat} className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Join the conversation…"
                className="bg-secondary/50 border-secondary text-xs h-9 flex-1"
                maxLength={500}
              />
              <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={postChatMutation.isPending || !chatInput.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm" className="w-full text-xs h-9">Sign in to chat</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
