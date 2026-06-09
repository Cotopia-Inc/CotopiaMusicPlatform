import { useParams } from "wouter";
import {
  useGetVideo, getGetVideoQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateVideo, useFavoriteVideo, useUnfavoriteVideo,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, Send, Radio, Users, BadgeCheck, MessageCircle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef, useCallback } from "react";
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

export default function VideoDetail() {
  const { id } = useParams();
  const videoId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) }
  });

  const { data: chatMessages, isLoading: loadingChat } = useGetChatMessages("video", videoId, {}, {
    query: { enabled: !!videoId, queryKey: getGetChatMessagesQueryKey("video", videoId) }
  });

  const [chatInput, setChatInput] = useState("");
  const [localFavorited, setLocalFavorited] = useState<boolean | null>(null);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handlePlayVideo = useCallback(() => {
    setIsVideoPlaying(true);
    setTimeout(() => videoRef.current?.play(), 50);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.requestFullscreen?.();
    }
  }, []);

  const postChatMutation = usePostChatMessage();
  const rateMutation = useRateVideo();
  const favoriteMutation = useFavoriteVideo();
  const unfavoriteMutation = useUnfavoriteVideo();

  const isFavorited = localFavorited ?? video?.isFavorited ?? false;
  const userRating = localRating ?? video?.userRating ?? null;
  const viewerCount = useRef(Math.floor(Math.random() * 500) + 48).current;

  useEffect(() => {
    if (video) {
      setLocalFavorited(video.isFavorited ?? false);
      setLocalRating(video.userRating ?? null);
    }
  }, [video?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages?.length]);

  const handleToggleFavorite = () => {
    if (!user) {
      toast({ title: "Sign in to favorite", description: "Create an account to save your favorite videos." });
      return;
    }
    const next = !isFavorited;
    setLocalFavorited(next);
    if (next) {
      favoriteMutation.mutate({ id: videoId }, {
        onError: () => { setLocalFavorited(!next); toast({ variant: "destructive", title: "Failed to favorite" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) }),
      });
    } else {
      unfavoriteMutation.mutate({ id: videoId }, {
        onError: () => { setLocalFavorited(!next); toast({ variant: "destructive", title: "Failed to unfavorite" }); },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) }),
      });
    }
  };

  const handleRate = (star: number) => {
    if (!user) {
      toast({ title: "Sign in to rate", description: "Create an account to rate videos." });
      return;
    }
    const newRating = userRating === star ? 0 : star;
    setLocalRating(newRating === 0 ? null : newRating);
    rateMutation.mutate({ id: videoId, data: { rating: newRating } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) }),
      onError: () => {
        setLocalRating(userRating);
        toast({ variant: "destructive", title: "Failed to rate" });
      },
    });
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    postChatMutation.mutate({ contentType: "video", contentId: videoId, data: { message: chatInput } }, {
      onSuccess: () => {
        setChatInput("");
        queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey("video", videoId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    );
  }

  if (!video) return <div className="p-8 text-center text-muted-foreground">Video not found</div>;

  return (
    <div className="pb-24 space-y-4">
      {/* ── Video player with chat overlay ── */}
      <div className="relative w-full rounded-xl overflow-hidden bg-black border border-border shadow-2xl" style={{ aspectRatio: "16/9" }}>
        {/* Real video element (shown once play is clicked) */}
        {isVideoPlaying && video.videoUrl ? (
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="absolute inset-0 w-full h-full object-contain"
            controls
            autoPlay
            style={{ zIndex: 10 }}
          />
        ) : (
          <>
            {/* Thumbnail */}
            {video.thumbnailUrl && (
              <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Play button (centered, shifted left so it clears chat) */}
            <div className="absolute inset-0 pr-72 flex items-center justify-center">
              <button
                onClick={handlePlayVideo}
                className="bg-primary text-primary-foreground rounded-full p-5 hover:scale-110 transition-transform duration-300 shadow-2xl shadow-primary/40"
              >
                <Play className="w-10 h-10 fill-current ml-1" />
              </button>
            </div>
          </>
        )}

        {/* Fullscreen button (when playing) */}
        {isVideoPlaying && video.videoUrl && (
          <button
            onClick={handleFullscreen}
            className="absolute top-3 left-3 z-20 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {/* Branding badge (hidden when video is playing with controls) */}
        {!isVideoPlaying && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
            <Radio className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-white font-semibold">Everyday Radio</span>
          </div>
        )}

        {/* ── Chat overlay panel ── */}
        <div className="absolute right-0 top-0 bottom-0 w-72 flex flex-col bg-black/75 backdrop-blur-md border-l border-white/10">
          {/* Chat header */}
          <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-white">Live Chat</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Users className="w-3 h-3" />
              <span>{viewerCount} watching</span>
            </div>
          </div>

          {/* Now playing strip */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 flex-shrink-0 bg-white/5">
            <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0 bg-white/10">
              {video.thumbnailUrl
                ? <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-primary/30 to-white/10" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold truncate leading-tight text-white">{video.title}</p>
              <p className="text-[9px] text-white/50 truncate leading-tight">{video.artistName}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0 scrollbar-thin">
            {loadingChat ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex gap-2 px-1">
                  <Skeleton className="w-6 h-6 rounded-full flex-shrink-0 bg-white/10" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-2.5 w-16 bg-white/10" />
                    <Skeleton className="h-6 w-full rounded bg-white/10" />
                  </div>
                </div>
              ))
            ) : chatMessages?.length ? (
              <>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex gap-2 px-1 group">
                    <div className="w-6 h-6 rounded-full bg-primary/30 overflow-hidden flex-shrink-0 text-[10px] flex items-center justify-center font-bold text-primary">
                      {msg.avatarUrl
                        ? <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                        : msg.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold text-primary mr-1.5">{msg.username}</span>
                      <span className="text-[10px] text-white/80 break-words leading-relaxed">{msg.message}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
                <MessageCircle className="w-8 h-8 text-white/20" />
                <p className="text-xs text-white/30">No messages yet</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-white/10 flex-shrink-0 bg-black/30">
            {user ? (
              <form onSubmit={handleChat} className="flex gap-1.5">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something…"
                  className="bg-white/10 border-white/10 text-white placeholder:text-white/30 text-xs h-8 flex-1 focus-visible:ring-primary/50"
                  maxLength={500}
                />
                <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0 bg-primary/80 hover:bg-primary" disabled={postChatMutation.isPending || !chatInput.trim()}>
                  <Send className="w-3 h-3" />
                </Button>
              </form>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="w-full text-[11px] h-8 text-white/60 hover:text-white hover:bg-white/10 border border-white/10">
                  Sign in to chat
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Video info below player ── */}
      <div className="space-y-3 px-1">
        {/* Title + metadata */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">{video.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href={`/artists/${video.artistId}`}>
              <span className="font-semibold text-foreground hover:text-primary cursor-pointer flex items-center gap-1">
                {video.artistName}
                <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              </span>
            </Link>
            <span>•</span>
            <span>{video.viewCount?.toLocaleString() || 0} views</span>
            <span>•</span>
            <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
            {video.genre && <><span>•</span><Badge variant="secondary" className="text-xs capitalize">{video.genre}</Badge></>}
          </div>
        </div>

        {/* Actions row — heart + stars on their own line, no overlap possible */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Heart */}
          <button
            onClick={handleToggleFavorite}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-sm font-medium ${
              isFavorited
                ? "bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20"
                : "border-border text-muted-foreground hover:border-red-400 hover:text-red-400"
            }`}
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`w-4 h-4 transition-all ${isFavorited ? "fill-current" : ""}`} />
            {isFavorited ? "Liked" : "Like"}
          </button>

          {/* Stars */}
          <div className="flex items-center gap-1" onMouseLeave={() => setHoveredRating(null)}>
            {[1, 2, 3, 4, 5].map((star) => {
              const displayRating = hoveredRating ?? userRating;
              const filled = displayRating !== null && displayRating >= star;
              return (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  className="p-0.5 hover:scale-125 transition-transform"
                  title={userRating === star ? "Click to clear rating" : `Rate ${star} stars`}
                >
                  <Star className={`w-5 h-5 transition-colors ${filled ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`} />
                </button>
              );
            })}
            <span className="text-sm text-muted-foreground ml-1 tabular-nums">
              {video.avgRating ? video.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* Description */}
        {video.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{video.description}</p>
        )}
      </div>
    </div>
  );
}
