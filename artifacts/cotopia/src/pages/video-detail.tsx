import { useParams } from "wouter";
import { useGetVideo, getGetVideoQueryKey, useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage, useRateVideo } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, Send, Radio, Users, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function VideoDetail() {
  const { id } = useParams();
  const videoId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) }
  });

  const { data: chatMessages, isLoading: loadingComments } = useGetChatMessages("video", videoId, {}, {
    query: { enabled: !!videoId, queryKey: getGetChatMessagesQueryKey("video", videoId) }
  });

  const [chatInput, setChatInput] = useState("");
  const postChatMutation = usePostChatMessage();
  const rateMutation = useRateVideo();

  const handleRate = (rating: number) => {
    rateMutation.mutate({ id: videoId, data: { rating } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) })
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

  const viewerCount = Math.floor(Math.random() * 500) + 48;

  return (
    <div className="pb-24 space-y-6">
      {/* Video + Chat Layout */}
      <div className="flex gap-5">
        {/* Video Player */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-border relative group shadow-2xl">
            {video.thumbnailUrl && (
              <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="bg-primary text-primary-foreground rounded-full p-5 hover:scale-110 transition-transform duration-300 shadow-2xl shadow-primary/40">
                <Play className="w-10 h-10 fill-current ml-1" />
              </button>
            </div>
            {/* Everyday Radio badge */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-white font-semibold">Everyday Radio</span>
            </div>
          </div>

          {/* Video Info */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
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
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400">
                  <Heart className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 cursor-pointer transition-colors ${video.userRating && video.userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`}
                      onClick={() => handleRate(star)}
                    />
                  ))}
                </div>
              </div>
            </div>
            {video.description && (
              <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">{video.description}</p>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-card/50 border border-border/50 rounded-xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          <div className="px-4 py-3 border-b border-border/50 bg-card flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Live Chat</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{viewerCount} watching</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loadingComments ? (
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
              chatMessages.map((msg) => (
                <div key={msg.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex-shrink-0 text-xs flex items-center justify-center font-bold text-muted-foreground">
                    {msg.avatarUrl ? (
                      <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                    ) : msg.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-muted-foreground">{msg.username}</span>
                    <div className="bg-secondary/50 rounded-lg px-3 py-2 mt-0.5">
                      <p className="text-xs leading-relaxed break-words">{msg.message}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Radio className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Chat is empty.</p>
                <p className="text-xs text-muted-foreground">Start the conversation!</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/50 flex-shrink-0">
            {user ? (
              <form onSubmit={handleChat} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something..."
                  className="bg-secondary/50 border-secondary text-xs h-8"
                />
                <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0" disabled={postChatMutation.isPending || !chatInput.trim()}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="w-full text-xs h-8">Sign in to chat</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
