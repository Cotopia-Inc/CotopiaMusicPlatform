import { useParams, useLocation } from "wouter";
import {
  useGetSong, getGetSongQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateSong, useFavoriteSong, useUnfavoriteSong,
  useDeleteSong, useUpdateSong, useTrackAnalyticsEvent,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, Heart, Star, Send, Radio, Users, MessageCircle, ArrowLeft, Trash2, Edit2, X, Save } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlayer } from "@/lib/player";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { UserLink } from "@/components/user-link";

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
  const [deletingChatMsgId, setDeletingChatMsgId] = useState<number | null>(null);
  const [localFavorited, setLocalFavorited] = useState<boolean | null>(null);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { play: playerPlay, isPlaying, track: currentTrack } = usePlayer();
  const isThisSongPlaying = isPlaying && currentTrack?.id === songId;

  const trackEvent = useTrackAnalyticsEvent();
  useEffect(() => {
    if (song?.id) {
      trackEvent.mutate({ data: { eventType: "page_view", eventName: "song_page", contentType: "song" as const, contentId: song.id } });
    }
  }, [song?.id]);

  const postChatMutation = usePostChatMessage();

  async function handleDeleteChatMsg(msgId: number) {
    setDeletingChatMsgId(msgId);
    const token = localStorage.getItem("cotopia_token");
    try {
      await fetch(`/api/chat/msg/${msgId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey("song", songId) });
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    } finally {
      setDeletingChatMsgId(null);
    }
  }
  const rateMutation = useRateSong();
  const favoriteMutation = useFavoriteSong();
  const unfavoriteMutation = useUnfavoriteSong();
  const deleteSongMutation = useDeleteSong();
  const updateSongMutation = useUpdateSong();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleOpenEdit = () => {
    setEditTitle(song?.title ?? "");
    setEditGenre(song?.genre ?? "");
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!song) return;
    updateSongMutation.mutate(
      { id: songId, data: { title: editTitle.trim(), genre: editGenre.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) });
          setEditOpen(false);
          toast({ title: "Track updated" });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update track" }),
      }
    );
  };

  const handleDeleteSong = () => {
    if (!song) return;
    deleteSongMutation.mutate({ id: songId }, {
      onSuccess: () => { toast({ title: "Track deleted" }); navigate("/songs"); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete track" }),
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
        {/* Back navigation */}
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

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
            <Badge variant="outline" className={`text-[10px] uppercase tracking-widest ${
              song.releaseType === "ep" ? "border-purple-500/40 text-purple-400" :
              song.releaseType === "album" ? "border-primary/40 text-primary" :
              "border-blue-500/40 text-blue-400"
            }`}>
              {song.releaseType === "ep" ? "EP" : song.releaseType === "album" ? "Album" : "Single"}
            </Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-none">{song.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <UserLink
                username={song.artistName}
                artistId={song.artistId}
                role="artist"
                isVerified={song.artistIsVerified ?? false}
                className="font-semibold text-foreground"
              />
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
            title={isThisSongPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
            onClick={() => song && playerPlay({ id: song.id, title: song.title, artistName: song.artistName ?? "", coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration, isFavorited })}
          >
            {isThisSongPlaying
              ? <Pause className="w-6 h-6 fill-current" />
              : <Play className="w-6 h-6 ml-0.5 fill-current" />}
          </Button>

          {/* Heart toggle */}
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

          {/* Star rating */}
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
            <span className="text-sm text-muted-foreground ml-2 tabular-nums">
              {song.avgRating ? song.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* ── Owner Controls ── */}
        {song.artistUserId != null && user?.id === song.artistUserId && (
          <div className="space-y-3">
            {!editOpen && !confirmDelete && (
              <div className="flex items-center gap-2">
                <button onClick={handleOpenEdit} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Edit track
                </button>
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-500 transition-colors border border-red-500/20 hover:border-red-500/40 rounded-lg px-3 py-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
            {editOpen && (
              <div className="bg-secondary/40 rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Edit Track</span>
                  <button onClick={() => setEditOpen(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
                  <Input value={editGenre} onChange={e => setEditGenre(e.target.value)} placeholder="e.g. Hip-Hop, Pop…" className="h-8 text-sm bg-secondary/50" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateSongMutation.isPending || !editTitle.trim()} className="h-7 text-xs gap-1.5">
                    <Save className="w-3 h-3" /> {updateSongMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
            {confirmDelete && (
              <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4 space-y-3">
                <p className="text-sm font-medium">Delete this track permanently?</p>
                <p className="text-xs text-muted-foreground">This will remove the track and all associated data. This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 text-xs">Cancel</Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteSong} disabled={deleteSongMutation.isPending} className="h-7 text-xs">
                    {deleteSongMutation.isPending ? "Deleting…" : "Yes, delete permanently"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {song.genre && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{song.genre}</Badge>
          </div>
        )}

        {/* Credits */}
        {(song as any).credits && (
          <div className="bg-secondary/30 rounded-xl border border-border/50 p-5 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Credits</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{(song as any).credits}</p>
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
              <UserLink
                username={song.artistName}
                artistId={song.artistId}
                role="artist"
                isVerified={song.artistIsVerified ?? false}
                className="text-[10px] text-muted-foreground"
              />
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
              {chatMessages.map((msg) => {
                const isOwn = msg.userId === user?.id;
                const isDeleting = deletingChatMsgId === msg.id;
                return (
                  <div key={msg.id} className="flex gap-2 group">
                    <div className="w-7 h-7 rounded-full bg-primary/20 overflow-hidden flex-shrink-0 text-xs flex items-center justify-center font-bold text-primary">
                      {msg.avatarUrl
                        ? <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                        : msg.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <UserLink
                          username={msg.username}
                          userId={msg.userId}
                          role={msg.role ?? undefined}
                          isVerified={msg.isVerified}
                          artistId={msg.artistId}
                          className="text-[11px] font-semibold text-foreground"
                        />
                        <span className="text-[10px] text-muted-foreground/60">{formatTime(msg.createdAt)}</span>
                        {isOwn && !isDeleting && (
                          <button
                            onClick={() => handleDeleteChatMsg(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0 text-muted-foreground/50 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className={`bg-secondary/60 rounded-lg px-3 py-2 mt-0.5 ${isDeleting ? "opacity-40" : ""}`}>
                        <p className="text-xs leading-relaxed break-words text-foreground/90">{isDeleting ? "Deleting…" : msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" title="Send message" disabled={postChatMutation.isPending || !chatInput.trim()}>
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
