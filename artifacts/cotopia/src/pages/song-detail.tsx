import { useParams } from "wouter";
import { useGetSong, getGetSongQueryKey, useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage, useRateSong } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, Send, Radio, Users, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function SongDetail() {
  const { id } = useParams();
  const songId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  const { data: chatMessages, isLoading: loadingComments } = useGetChatMessages("song", songId, {}, {
    query: { enabled: !!songId, queryKey: getGetChatMessagesQueryKey("song", songId) }
  });

  const [chatInput, setChatInput] = useState("");
  const postChatMutation = usePostChatMessage();
  const rateMutation = useRateSong();

  const handleRate = (rating: number) => {
    rateMutation.mutate({ id: songId, data: { rating } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) })
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
        <div className="flex gap-8 items-end h-64">
          <Skeleton className="w-64 h-64 rounded-md shadow-2xl" />
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

  const listenCount = Math.floor(Math.random() * 200) + 12;

  return (
    <div className="flex gap-6 pb-24 h-full">
      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-8 items-end">
          <div className="w-56 h-56 rounded-xl shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0">
            {song.coverUrl ? (
              <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-primary/20 to-secondary">
                <Radio className="w-12 h-12 text-primary/40" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-primary/30 text-primary">Song</Badge>
            </div>
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
        <div className="flex items-center gap-4">
          <Button size="icon" className="w-14 h-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform shadow-lg shadow-primary/30">
            <Play className="w-6 h-6 ml-0.5 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400 transition-colors">
            <Heart className="w-7 h-7" />
          </Button>
          <div className="flex items-center gap-1 ml-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 cursor-pointer transition-colors ${song.userRating && song.userRating >= star ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'}`}
                onClick={() => handleRate(star)}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-2">
              {song.avgRating ? song.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* Details */}
        {song.genre && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{song.genre}</Badge>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-card/50 border border-border/50 rounded-xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-card flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold">Fan Chat</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{listenCount} listening</span>
          </div>
        </div>

        {/* Messages */}
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
              <p className="text-xs text-muted-foreground">No messages yet.</p>
              <p className="text-xs text-muted-foreground">Be the first to chat!</p>
            </div>
          )}
        </div>

        {/* Input */}
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
              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                Sign in to chat
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
