import { useParams, useLocation } from "wouter";
import { useSeo } from "@/hooks/use-seo";
import {
  useGetSong, getGetSongQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateSong, useFavoriteSong, useUnfavoriteSong,
  useDeleteSong, useUpdateSong, useUpdateArtist, useTrackAnalyticsEvent,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, Heart, Star, Send, Radio, Users, MessageCircle, ArrowLeft, Trash2, Edit2, X, Save, Upload, ImageIcon, Mic2, ChevronDown, ChevronUp, AlignLeft } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";
import { usePlayer } from "@/lib/player";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { UserLink } from "@/components/user-link";
import { useUpload } from "@workspace/object-storage-web";
import { SongMenu } from "@/components/song-menu";
import { ReportModal } from "@/components/report-modal";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { CommentSection } from "@/components/comment-section";

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
  const config = usePlatformConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  useSeo({
    title: song ? `${song.title} by ${song.artistName}` : "Song",
    description: song
      ? `Listen to "${song.title}" by ${song.artistName} on Everyday Radio by Cotopia.${song.genre ? ` Genre: ${song.genre}.` : ""}`
      : undefined,
    image: (song as any)?.coverArtUrl ?? undefined,
    type: "music.song",
    noindex: !song,
    jsonLd: song
      ? {
          "@context": "https://schema.org",
          "@type": "MusicRecording",
          name: song.title,
          byArtist: { "@type": "MusicGroup", name: song.artistName },
          ...(song.genre ? { genre: song.genre } : {}),
        }
      : undefined,
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
  const updateArtistMutation = useUpdateArtist();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editLyrics, setEditLyrics] = useState("");
  const [editCredits, setEditCredits] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const coverUpload = useUpload({
    onSuccess: (res) => setEditCoverUrl(`/api/storage${res.objectPath}`),
  });

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
    setEditCoverUrl(song?.coverUrl ?? "");
    setEditLyrics((song as any)?.lyrics ?? "");
    setEditCredits((song as any)?.credits ?? "");
    setEditStageName(song?.artistName ?? "");
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!song) return;
    const stageNameChanged = editStageName.trim() && editStageName.trim() !== song.artistName;
    const songPromise = new Promise<void>((resolve, reject) => {
      updateSongMutation.mutate(
        { id: songId, data: { title: editTitle.trim(), genre: editGenre.trim() || undefined, coverUrl: editCoverUrl || undefined, lyrics: editLyrics.trim() || undefined, credits: editCredits.trim() || undefined } },
        { onSuccess: () => resolve(), onError: reject }
      );
    });
    const artistPromise = stageNameChanged && song.artistId
      ? new Promise<void>((resolve, reject) => {
          updateArtistMutation.mutate(
            { id: song.artistId!, data: { stageName: editStageName.trim() } },
            { onSuccess: () => resolve(), onError: reject }
          );
        })
      : Promise.resolve();
    Promise.all([songPromise, artistPromise])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) });
        setEditOpen(false);
        toast({ title: "Track updated" });
      })
      .catch(() => toast({ variant: "destructive", title: "Failed to update track" }));
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
          <div className="w-40 h-40 md:w-56 md:h-56 rounded-xl shadow-2xl overflow-hidden bg-secondary border border-border flex-shrink-0">
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
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter leading-none">{song.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <UserLink
                username={song.artistName}
                artistId={song.artistId}
                role={song.artistUserRole}
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
            onClick={() => song && playerPlay({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistUserRole: (song as any).artistUserRole ?? null, artistIsVerified: (song as any).artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration, isFavorited })}
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

          {/* Queue + Playlist menu */}
          {song && (
            <SongMenu
              song={song}
              className="border border-border text-muted-foreground hover:text-foreground hover:border-border/80 w-9 h-9 rounded-full"
            />
          )}

          {/* Report song */}
          {user && song && (
            <ReportModal targetType="song" targetId={song.id} />
          )}

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
            {(song as any).ratingCount > 0 && (
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                ({(song as any).ratingCount} {(song as any).ratingCount === 1 ? 'rating' : 'ratings'})
              </span>
            )}
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
                  <label className="text-xs text-muted-foreground mb-1 block">Stage Name</label>
                  <Input value={editStageName} onChange={e => setEditStageName(e.target.value)} placeholder="Your artist name…" className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
                  <Input value={editGenre} onChange={e => setEditGenre(e.target.value)} placeholder="e.g. Hip-Hop, Pop…" className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cover Image</label>
                  <div className="flex items-center gap-3">
                    {editCoverUrl ? (
                      <div className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0 bg-secondary border border-border">
                        <img src={editCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                        <button onClick={() => setEditCoverUrl("")} className="absolute top-0.5 right-0.5 bg-black/60 rounded p-0.5" title="Remove">
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ) : null}
                    <label className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2 flex-1">
                      {coverUpload.isUploading ? (
                        <><Upload className="w-3.5 h-3.5" /> Uploading {coverUpload.progress}%</>
                      ) : (
                        <><ImageIcon className="w-3.5 h-3.5" /> {editCoverUrl ? "Change image" : "Upload image"}</>
                      )}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) coverUpload.uploadFile(f); }} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Lyrics</label>
                  <Textarea value={editLyrics} onChange={e => setEditLyrics(e.target.value)} placeholder="Add lyrics…" className="text-sm bg-secondary/50 min-h-[100px] resize-y" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Credits</label>
                  <Textarea value={editCredits} onChange={e => setEditCredits(e.target.value)} placeholder="Produced by, written by…" className="text-sm bg-secondary/50 min-h-[60px] resize-y" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateSongMutation.isPending || updateArtistMutation.isPending || !editTitle.trim() || coverUpload.isUploading} className="h-7 text-xs gap-1.5">
                    <Save className="w-3 h-3" /> {(updateSongMutation.isPending || updateArtistMutation.isPending) ? "Saving…" : "Save"}
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

        {/* Lyrics */}
        {(() => {
          const lyrics: string = (song as any).lyrics ?? "";
          const isOwner = song.artistUserId != null && user?.id === song.artistUserId;
          const lines = lyrics.split("\n");
          const isLong = lines.length > 12 || lyrics.length > 600;
          if (!lyrics && !isOwner) return null;
          return (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/40 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Mic2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lyrics</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    {lyrics ? "Edit" : "Add lyrics"}
                  </button>
                )}
              </div>
              {lyrics ? (
                <div className="px-5 py-4 bg-card/50">
                  <div className={`relative transition-all overflow-hidden ${isLong && !lyricsExpanded ? "max-h-64" : ""}`}>
                    <p className="text-sm leading-8 whitespace-pre-wrap text-foreground/85 font-light tracking-wide">
                      {lyrics}
                    </p>
                    {isLong && !lyricsExpanded && (
                      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-card/90 to-transparent pointer-events-none" />
                    )}
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setLyricsExpanded(!lyricsExpanded)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {lyricsExpanded
                        ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
                        : <><ChevronDown className="w-3.5 h-3.5" />Show all lyrics</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No lyrics added yet.</p>
                  <button onClick={() => setEditOpen(true)} className="mt-1.5 text-xs text-primary hover:underline">Add lyrics</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Credits */}
        {(() => {
          const credits: string = (song as any).credits ?? "";
          const isOwner = song.artistUserId != null && user?.id === song.artistUserId;
          if (!credits && !isOwner) return null;
          return (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/40 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Credits</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    {credits ? "Edit" : "Add credits"}
                  </button>
                )}
              </div>
              {credits ? (
                <div className="px-5 py-4 bg-card/50">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{credits}</p>
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No credits added yet.</p>
                  <button onClick={() => setEditOpen(true)} className="mt-1.5 text-xs text-primary hover:underline">Add credits</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Comments */}
        <div className="bg-card border border-border rounded-xl p-5">
          <CommentSection contentType="song" contentId={song.id} />
        </div>
      </div>

      {/* ── Chat Panel (desktop only) ── */}
      <div
        className="hidden md:flex w-80 flex-shrink-0 flex-col bg-card border border-border rounded-xl overflow-hidden"
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
                role={song.artistUserRole}
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
                          primaryBadge={(msg as any).primaryBadge ?? null}
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
                        {!isOwn && user && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
                            <ReportModal targetType="chat_message" targetId={msg.id} />
                          </div>
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
          {user && config.requireEmailVerification && !(user as any).emailVerified && (
            <VerifyEmailBanner action="join the chat" className="mb-3" />
          )}
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
