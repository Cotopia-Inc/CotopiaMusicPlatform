import { useParams } from "wouter";
import {
  useGetVideo, getGetVideoQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateVideo, useFavoriteVideo, useUnfavoriteVideo,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, Send, Radio, Users, BadgeCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      <div className="space-y-6 pb-24">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    );
  }

  if (!video) return <div className="p-8 text-center text-muted-foreground">Video not found</div>;

  return (
    <div className="pb-24 space-y-0">
      {/* Video + Chat side-by-side */}
      <div className="flex gap-5" style={{ height: "calc(100vh - 7rem)" }}>
        {/* Left: video + info */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pb-4">
          {/* Video player */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-border relative group shadow-2xl flex-shrink-0">
            {video.thumbnailUrl && (
              <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="bg-primary text-primary-foreground rounded-full p-5 hover:scale-110 transition-transform duration-300 shadow-2xl shadow-primary/40">
                <Play className="w-10 h-10 fill-current ml-1" />
              </button>
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-white font-semibold">Everyday Radio</span>
            </div>
          </div>

          {/* Video info */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 flex-1 min-w-0">
                <h1 className="text-3xl font-extrabold tracking-tight">{video.title}</h1>
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

              {/* Actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Heart */}
                <button
                  onClick={handleToggleFavorite}
                  className={`p-1.5 rounded-full transition-all hover:scale-110 ${isFavorited ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart className={`w-5 h-5 transition-all ${isFavorited ? "fill-current" : ""}`} />
                </button>

                {/* Stars */}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRate(star)}
                      className="p-0.5 hover:scale-125 transition-transform"
                      title={userRating === star ? "Click to clear rating" : `Rate ${star} stars`}
                    >
                      <Star className={`w-4 h-4 transition-colors ${userRating && userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground/40 hover:text-primary'}`} />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                    {video.avgRating ? video.avgRating.toFixed(1) : '—'}
                  </span>
                </div>
              </div>
            </div>
            {video.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{video.description}</p>
            )}
          </div>
        </div>

        {/* Right: chat panel */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border bg-card/80 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Live Chat</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{viewerCount} watching</span>
            </div>
          </div>

          {/* Now Playing strip */}
          {video && (
            <div className="px-3 py-2 border-b border-border/50 bg-primary/5 flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-secondary">
                {video.thumbnailUrl
                  ? <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate leading-tight">{video.title}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">{video.artistName}</p>
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
                  <div key={msg.id} className="flex gap-2">
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
    </div>
  );
}
