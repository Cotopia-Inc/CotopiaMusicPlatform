import { useParams, useLocation } from "wouter";
import { useSeo } from "@/hooks/use-seo";
import { LinkifiedText } from "@/components/linkified-text";
import {
  useGetVideo, getGetVideoQueryKey,
  useGetChatMessages, getGetChatMessagesQueryKey, usePostChatMessage,
  useRateVideo, useFavoriteVideo, useUnfavoriteVideo, useTrackAnalyticsEvent,
  useDeleteVideo, useUpdateVideo, useUpdateArtist, useRecordVideoView,
  useGetPresenceCount, usePostPresenceHeartbeat, useDeletePresence,
  useGetCreatorSupportStatus,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Heart, Star, Send, Users, MessageCircle, Maximize2, ArrowLeft, Trash2, Edit2, X, Save, Upload, ImageIcon, ListPlus, Pencil, Shield, ShieldOff, Check, AlignLeft, ChevronDown, ChevronUp } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { ImageCropModal } from "@/components/image-crop-modal";
import { ReportModal } from "@/components/report-modal";
import { SupportButton } from "@/components/support-modal";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { UserLink } from "@/components/user-link";
import { useUpload } from "@/lib/useUpload";
import { usePlayer } from "@/lib/player";
import { CommentSection } from "@/components/comment-section";
import { AiOriginBadge, type CreationMethod } from "@/components/ai-origin-badge";
import { AiReviewCard } from "@/components/ai-review-card";

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
  const config = usePlatformConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addToQueue } = usePlayer();

  const { data: video, isLoading } = useGetVideo(videoId, {
    query: { enabled: !!videoId, queryKey: getGetVideoQueryKey(videoId) }
  });

  const { data: videoSupportStatus } = useGetCreatorSupportStatus(
    (video as any)?.artistUserId ?? 0,
    { contentType: "video", contentId: videoId },
    { query: { enabled: !!(video as any)?.artistUserId, queryKey: ["getCreatorSupportStatus", (video as any)?.artistUserId, "video", videoId] } },
  );

  useSeo({
    title: video ? `${video.title} by ${video.artistName}` : "Video",
    description: video
      ? (video as any)?.description?.trim() || `Watch "${video.title}" by ${video.artistName} on Everyday Radio by Cotopia.`
      : undefined,
    image: (video as any)?.thumbnailUrl ?? undefined,
    type: "video.other",
    noindex: !video,
    jsonLd: video
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: video.title,
          description: (video as any)?.description || `${video.title} by ${video.artistName}`,
          thumbnailUrl: (video as any)?.thumbnailUrl ?? undefined,
        }
      : undefined,
  });

  const { data: chatMessages, isLoading: loadingChat } = useGetChatMessages("video", videoId, {}, {
    query: { enabled: !!videoId, queryKey: getGetChatMessagesQueryKey("video", videoId) }
  });

  const presenceClientId = useRef<string>(
    (() => {
      const KEY = "cotopia_presence_client_id";
      let existing = sessionStorage.getItem(KEY);
      if (!existing) {
        existing = crypto.randomUUID();
        sessionStorage.setItem(KEY, existing);
      }
      return existing;
    })()
  ).current;

  const { data: presence } = useGetPresenceCount("video", videoId, {
    query: { enabled: !!videoId, refetchInterval: 15_000, queryKey: ["getPresenceCount", "video", videoId] }
  });
  const heartbeatMutation = usePostPresenceHeartbeat();
  const releasePresenceMutation = useDeletePresence();

  // Tracks the video element's actual play/pause state (not just whether it's mounted).
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  // Guards against double-counting: only record a view once per loaded video,
  // and only once the <video> element genuinely confirms playback started
  // (never just because the Play button was clicked) — clicking Play can
  // fail to actually play (autoplay restrictions, bad URL, network error),
  // which would otherwise inflate the view count and leave the timer stuck.
  const viewRecordedForRef = useRef<number | null>(null);
  // Guards against double-counting completions: at most one "video_complete"
  // per loaded video. Without this, replaying the same video after it ends
  // (without navigating away) would log a fresh completion every time even
  // though the view count only ever counts once per load, inflating the
  // completion rate above 100%.
  const completionRecordedForRef = useRef<number | null>(null);

  // Only counted as an active watcher while the video is actually playing.
  // Pausing or stopping immediately releases the presence slot; no fake/random counts.
  useEffect(() => {
    if (!videoId || !isActuallyPlaying) return;
    // A fresh token per play session — lets the server ignore a heartbeat that
    // was already in flight when this session ended, so it can't resurrect a
    // stale count after pause/stop.
    const epoch = crypto.randomUUID();
    heartbeatMutation.mutate({ contentType: "video", contentId: videoId, data: { clientId: presenceClientId, epoch } });
    const interval = setInterval(() => {
      heartbeatMutation.mutate({ contentType: "video", contentId: videoId, data: { clientId: presenceClientId, epoch } });
    }, 15_000);
    return () => {
      clearInterval(interval);
      releasePresenceMutation.mutate({ contentType: "video", contentId: videoId, params: { clientId: presenceClientId, epoch } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, isActuallyPlaying]);

  const [chatInput, setChatInput] = useState("");
  const [deletingChatMsgId, setDeletingChatMsgId] = useState<number | null>(null);
  const [editingChatMsgId, setEditingChatMsgId] = useState<number | null>(null);
  const [editingChatBody, setEditingChatBody] = useState("");
  const [savingChatEdit, setSavingChatEdit] = useState(false);
  const [chatBlockedUserIds, setChatBlockedUserIds] = useState<Set<number>>(new Set());
  const [chatBlockLoading, setChatBlockLoading] = useState<number | null>(null);
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

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
    setIsActuallyPlaying(false);
    if (videoId && completionRecordedForRef.current !== videoId) {
      completionRecordedForRef.current = videoId;
      trackEvent.mutate({ data: { eventType: "content", eventName: "video_complete", contentType: "video", contentId: videoId } });
    }
  }, [videoId]);

  // The native "play" event fires as soon as playback is *requested* (e.g.
  // right after calling play() or from the autoPlay attribute) — it does NOT
  // mean the browser actually has data and is rendering frames. A bad/broken
  // source can still fire "play" and then immediately error out. Only
  // "isActuallyPlaying" (used for presence heartbeats) is driven off it here.
  const handleVideoPlayEvent = useCallback(() => setIsActuallyPlaying(true), []);
  const handleVideoPauseEvent = useCallback(() => setIsActuallyPlaying(false), []);

  // "playing" only fires once the element has genuinely resumed/started
  // rendering media after buffering — this is the correct signal that
  // playback truly began. Record the view/analytics event exactly once per
  // loaded video here, instead of eagerly when the Play button is clicked or
  // on the unreliable "play" event (which may never result in real playback).
  const handleVideoPlayingEvent = useCallback(() => {
    if (videoId && viewRecordedForRef.current !== videoId) {
      viewRecordedForRef.current = videoId;
      trackEvent.mutate({ data: { eventType: "content", eventName: "video_play", contentType: "video", contentId: videoId } });
      recordVideoView.mutate({ id: videoId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) }),
      });
    }
  }, [videoId]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.requestFullscreen?.();
    }
  }, []);

  const postChatMutation = usePostChatMessage();

  async function handleDeleteChatMsg(msgId: number) {
    setDeletingChatMsgId(msgId);
    const token = localStorage.getItem("cotopia_token");
    try {
      await fetch(`/api/chat/msg/${msgId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey("video", videoId) });
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    } finally {
      setDeletingChatMsgId(null);
    }
  }

  async function handleEditChatMsg(msgId: number) {
    if (!editingChatBody.trim()) return;
    setSavingChatEdit(true);
    const token = localStorage.getItem("cotopia_token");
    try {
      await fetch(`/api/chat/msg/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: editingChatBody.trim() }),
      });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey("video", videoId) });
      setEditingChatMsgId(null);
    } catch {
      toast({ title: "Failed to edit message", variant: "destructive" });
    } finally {
      setSavingChatEdit(false);
    }
  }

  async function handleChatBlockToggle(targetUserId: number) {
    const isBlocked = chatBlockedUserIds.has(targetUserId);
    setChatBlockLoading(targetUserId);
    const token = localStorage.getItem("cotopia_token");
    try {
      if (isBlocked) {
        await fetch(`/api/users/block/${targetUserId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setChatBlockedUserIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next; });
        toast({ title: "User unblocked" });
      } else {
        await fetch("/api/users/block", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: targetUserId }) });
        setChatBlockedUserIds(prev => new Set([...prev, targetUserId]));
        toast({ title: "User blocked" });
      }
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setChatBlockLoading(null);
    }
  }
  const rateMutation = useRateVideo();
  const favoriteMutation = useFavoriteVideo();
  const unfavoriteMutation = useUnfavoriteVideo();
  const trackEvent = useTrackAnalyticsEvent();
  const recordVideoView = useRecordVideoView();

  useEffect(() => {
    if (video?.id) {
      trackEvent.mutate({ data: { eventType: "page_view", eventName: "video_page", contentType: "video" as const, contentId: video.id } });
    }
  }, [video?.id]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("cotopia_token");
    fetch("/api/users/blocks", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((ids: number[]) => Array.isArray(ids) && setChatBlockedUserIds(new Set(ids)))
      .catch(() => {});
  }, [user]);

  const deleteVideoMutation = useDeleteVideo();
  const updateVideoMutation = useUpdateVideo();
  const [, navigate] = useLocation();
  const updateArtistMutation = useUpdateArtist();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCredits, setEditCredits] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const thumbnailUpload = useUpload({
    onSuccess: (res) => setEditThumbnailUrl(`/api/storage${res.objectPath}`),
  });
  const [thumbCropUrl, setThumbCropUrl] = useState<string | null>(null);
  const handleThumbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setThumbCropUrl(URL.createObjectURL(f));
    e.target.value = "";
  };
  const handleThumbCropConfirm = async (blob: Blob) => {
    if (thumbCropUrl) URL.revokeObjectURL(thumbCropUrl);
    setThumbCropUrl(null);
    await thumbnailUpload.uploadFile(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
  };

  const isFavorited = localFavorited ?? video?.isFavorited ?? false;
  const userRating = localRating ?? video?.userRating ?? null;
  const viewerCount = presence?.count ?? 0;

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

  const handleOpenEdit = () => {
    setEditTitle(video?.title ?? "");
    setEditGenre(video?.genre ?? "");
    setEditThumbnailUrl(video?.thumbnailUrl ?? "");
    setEditDescription((video as any)?.description ?? "");
    setEditCredits((video as any)?.credits ?? "");
    setEditStageName((video as any)?.artistName ?? "");
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!video) return;
    const stageNameChanged = editStageName.trim() && editStageName.trim() !== (video as any).artistName;
    const videoPromise = new Promise<void>((resolve, reject) => {
      updateVideoMutation.mutate(
        { id: videoId, data: { title: editTitle.trim(), genre: editGenre.trim() || undefined, thumbnailUrl: editThumbnailUrl || undefined, description: editDescription.trim() || undefined, credits: editCredits.trim() || undefined } },
        { onSuccess: () => resolve(), onError: reject }
      );
    });
    const artistPromise = stageNameChanged && (video as any).artistId
      ? new Promise<void>((resolve, reject) => {
          updateArtistMutation.mutate(
            { id: (video as any).artistId, data: { stageName: editStageName.trim() } },
            { onSuccess: () => resolve(), onError: reject }
          );
        })
      : Promise.resolve();
    Promise.all([videoPromise, artistPromise])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) });
        setEditOpen(false);
        toast({ title: "Video updated" });
      })
      .catch(() => toast({ variant: "destructive", title: "Failed to update video" }));
  };

  const handleDeleteVideo = () => {
    if (!video) return;
    deleteVideoMutation.mutate({ id: videoId }, {
      onSuccess: () => { toast({ title: "Video deleted" }); navigate("/videos"); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete video" }),
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
      {/* Back navigation */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

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
            onEnded={handleVideoEnded}
            onPlay={handleVideoPlayEvent}
            onPlaying={handleVideoPlayingEvent}
            onPause={handleVideoPauseEvent}
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

            {/* Play button (centered, shifted left so it clears chat on desktop) */}
            <div className="absolute inset-0 md:pr-72 flex items-center justify-center">
              <button
                onClick={handlePlayVideo}
                aria-label={`Play ${video.title}`}
                title={`Play ${video.title}`}
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
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded-full">
            <img src="/logo.jpg" alt="Cotopia" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            <span className="text-[10px] text-white font-semibold">Everyday Radio</span>
          </div>
        )}

        {/* ── Chat overlay panel (desktop only) ── */}
        <div className="hidden md:flex absolute right-0 top-0 bottom-0 w-72 flex-col bg-black/75 backdrop-blur-md border-l border-white/10">
          {/* Chat header */}
          <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${viewerCount > 0 ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
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
              <UserLink
                username={video.artistName}
                artistId={video.artistId}
                role={video.artistUserRole}
                isVerified={video.artistIsVerified ?? false}
                className="text-[9px] text-white/50"
              />
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
                {chatMessages.map((msg) => {
                  const isOwn = msg.userId === user?.id;
                  const isDeleting = deletingChatMsgId === msg.id;
                  const isEditing = editingChatMsgId === msg.id;
                  const isBlocked = chatBlockedUserIds.has(msg.userId);
                  return (
                    <div key={msg.id} className="flex gap-2 px-1 group">
                      <div className="w-6 h-6 rounded-full bg-primary/30 overflow-hidden flex-shrink-0 text-[10px] flex items-center justify-center font-bold text-primary mt-0.5">
                        {msg.avatarUrl
                          ? <img src={msg.avatarUrl} alt={msg.username} className="w-full h-full object-cover" />
                          : msg.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex gap-1 items-center">
                            <input
                              value={editingChatBody}
                              onChange={e => setEditingChatBody(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleEditChatMsg(msg.id);
                                if (e.key === "Escape") setEditingChatMsgId(null);
                              }}
                              className="flex-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded border border-white/20 focus:outline-none min-w-0"
                              autoFocus
                              maxLength={500}
                              disabled={savingChatEdit}
                            />
                            <button onClick={() => handleEditChatMsg(msg.id)} disabled={savingChatEdit} className="text-primary hover:text-primary/80 p-0.5 flex-shrink-0" title="Save">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingChatMsgId(null)} className="text-white/40 hover:text-white p-0.5 flex-shrink-0" title="Cancel">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1.5">
                            <UserLink
                              username={msg.username}
                              userId={msg.userId}
                              role={msg.role ?? undefined}
                              isVerified={msg.isVerified}
                              artistId={msg.artistId}
                              primaryBadge={(msg as any).primaryBadge ?? null}
                              className="text-[10px] font-semibold text-primary flex-shrink-0"
                            />
                            <span className={`text-[10px] break-words leading-relaxed flex-1 min-w-0 ${isDeleting ? "opacity-40" : "text-white/80"}`}>
                              {isDeleting ? "Deleting…" : <LinkifiedText text={msg.message} />}
                            </span>
                            {isOwn && !isDeleting && (
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0 flex gap-0.5">
                                <button
                                  onClick={() => { setEditingChatMsgId(msg.id); setEditingChatBody(msg.message); }}
                                  className="text-white/30 hover:text-primary p-0.5 rounded"
                                  title="Edit"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteChatMsg(msg.id)}
                                  className="text-white/30 hover:text-red-400 p-0.5 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            )}
                            {!isOwn && user && !isDeleting && (
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0 flex gap-0.5 items-center">
                                <button
                                  onClick={() => handleChatBlockToggle(msg.userId)}
                                  disabled={chatBlockLoading === msg.userId}
                                  className={`p-0.5 rounded ${isBlocked ? "text-green-400 hover:text-green-300" : "text-white/30 hover:text-amber-400"}`}
                                  title={isBlocked ? "Unblock user" : "Block user"}
                                >
                                  {isBlocked ? <ShieldOff className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                                </button>
                                <ReportModal targetType="chat_message" targetId={msg.id} />
                                <ReportModal targetType="profile" targetId={msg.userId} />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
            {user && config.requireEmailVerification && !(user as any).emailVerified && (
              <VerifyEmailBanner action="join the chat" className="mb-2" />
            )}
            {user ? (
              <form onSubmit={handleChat} className="flex gap-1.5">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something…"
                  className="bg-white/10 border-white/10 text-white placeholder:text-white/30 text-xs h-8 flex-1 focus-visible:ring-primary/50"
                  maxLength={500}
                />
                <Button type="submit" size="icon" className="h-8 w-8 flex-shrink-0 bg-primary/80 hover:bg-primary" title="Send message" disabled={postChatMutation.isPending || !chatInput.trim()}>
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
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{video.title}</h1>
          {(video as any).effectiveDisplayTag && (video as any).effectiveDisplayTag !== "unclassified" && (
            <AiOriginBadge method={(video as any).effectiveDisplayTag as CreationMethod} variant="title" />
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <UserLink
              username={video.artistName}
              artistId={video.artistId}
              role={video.artistUserRole}
              isVerified={video.artistIsVerified ?? false}
              className="font-semibold text-foreground"
            />
            <span>•</span>
            <span>{video.viewCount?.toLocaleString() || 0} views</span>
            <span>•</span>
            <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
            {video.genre && <><span>•</span><Badge variant="secondary" className="text-xs capitalize">{video.genre}</Badge></>}
            {videoSupportStatus?.supportEnabled && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {(videoSupportStatus.contentSupporterCount ?? 0).toLocaleString()} supporters</span>
              </>
            )}
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

          {/* Add to queue */}
          {video && (
            <button
              onClick={() => {
                addToQueue([{
                  id: video.id,
                  title: video.title,
                  artistName: video.artistName ?? "",
                  artistId: video.artistId,
                  artistUserRole: video.artistUserRole ?? null, artistIsVerified: video.artistIsVerified ?? false,
                  coverUrl: video.thumbnailUrl,
                  videoUrl: video.videoUrl,
                  duration: video.duration,
                }]);
                toast({ title: "Added to queue", description: video.title });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all text-sm font-medium"
              title="Add to queue"
            >
              <ListPlus className="w-4 h-4" />
              Add to queue
            </button>
          )}

          {/* Support creator */}
          <SupportButton
            creatorUserId={video.artistUserId}
            creatorName={video.artistName}
            contentType="video"
            contentId={video.id}
          />

          {/* Report video */}
          {user && (
            <ReportModal
              targetType="video"
              targetId={video.id}
              variant="button"
              className="px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all text-sm font-medium"
            />
          )}

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
            {(video as any).ratingCount > 0 && (
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                ({(video as any).ratingCount} {(video as any).ratingCount === 1 ? 'rating' : 'ratings'})
              </span>
            )}
          </div>
        </div>

        {/* ── Owner Controls ── */}
        {video.artistUserId != null && user?.id === video.artistUserId && (
          <div className="space-y-3">
            {!editOpen && !confirmDelete && (
              <div className="flex items-center gap-2">
                <button onClick={handleOpenEdit} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Edit video
                </button>
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-500 transition-colors border border-red-500/20 hover:border-red-500/40 rounded-lg px-3 py-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
            {editOpen && (
              <div className="bg-secondary/40 rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Edit Video</span>
                  <button onClick={() => setEditOpen(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
                <div>
                  <label htmlFor="edit-video-stage-name" className="text-xs text-muted-foreground mb-1 block">Stage Name</label>
                  <Input id="edit-video-stage-name" value={editStageName} onChange={e => setEditStageName(e.target.value)} placeholder="Your artist name…" className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label htmlFor="edit-video-title" className="text-xs text-muted-foreground mb-1 block">Title</label>
                  <Input id="edit-video-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label htmlFor="edit-video-genre" className="text-xs text-muted-foreground mb-1 block">Genre</label>
                  <Input id="edit-video-genre" value={editGenre} onChange={e => setEditGenre(e.target.value)} placeholder="e.g. Hip-Hop, Pop…" className="h-8 text-sm bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Thumbnail</label>
                  <div className="flex items-center gap-3">
                    {editThumbnailUrl ? (
                      <div className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0 bg-secondary border border-border">
                        <img src={editThumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        <button onClick={() => setEditThumbnailUrl("")} className="absolute top-0.5 right-0.5 bg-black/60 rounded p-0.5" title="Remove">
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ) : null}
                    <label className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2 flex-1">
                      {thumbnailUpload.isUploading ? (
                        <><Upload className="w-3.5 h-3.5" /> Uploading {thumbnailUpload.progress}%</>
                      ) : (
                        <><ImageIcon className="w-3.5 h-3.5" /> {editThumbnailUrl ? "Change thumbnail" : "Upload thumbnail"}</>
                      )}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleThumbFile} />
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-video-description" className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <Textarea id="edit-video-description" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="What's this video about…" className="text-sm bg-secondary/50 min-h-[80px] resize-y" />
                </div>
                <div>
                  <label htmlFor="edit-video-credits" className="text-xs text-muted-foreground mb-1 block">Credits</label>
                  <Textarea id="edit-video-credits" value={editCredits} onChange={e => setEditCredits(e.target.value)} placeholder="Directed by, produced by…" className="text-sm bg-secondary/50 min-h-[60px] resize-y" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateVideoMutation.isPending || updateArtistMutation.isPending || !editTitle.trim() || thumbnailUpload.isUploading} className="h-7 text-xs gap-1.5">
                    <Save className="w-3 h-3" /> {(updateVideoMutation.isPending || updateArtistMutation.isPending) ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
            {confirmDelete && (
              <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4 space-y-3">
                <p className="text-sm font-medium">Delete this video permanently?</p>
                <p className="text-xs text-muted-foreground">This will remove the video and all associated data. This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 text-xs">Cancel</Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteVideo} disabled={deleteVideoMutation.isPending} className="h-7 text-xs">
                    {deleteVideoMutation.isPending ? "Deleting…" : "Yes, delete permanently"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {(() => {
          const desc: string = video.description ?? "";
          const isOwner = video.artistUserId != null && user?.id === video.artistUserId;
          const isLong = desc.length > 400;
          if (!desc && !isOwner) return null;
          return (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/40 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About this video</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    {desc ? "Edit" : "Add description"}
                  </button>
                )}
              </div>
              {desc ? (
                <div className="px-5 py-4 bg-card/50">
                  <div className={`relative transition-all overflow-hidden ${isLong && !descExpanded ? "max-h-32" : ""}`}>
                    <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap"><LinkifiedText text={desc} /></p>
                    {isLong && !descExpanded && (
                      <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-card/90 to-transparent pointer-events-none" />
                    )}
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {descExpanded
                        ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
                        : <><ChevronDown className="w-3.5 h-3.5" />Read more</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No description added yet.</p>
                  <button onClick={() => setEditOpen(true)} className="mt-1.5 text-xs text-primary hover:underline">Add description</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Credits */}
        {(() => {
          const credits: string = (video as any).credits ?? "";
          const isOwner = video.artistUserId != null && user?.id === video.artistUserId;
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
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"><LinkifiedText text={credits} /></p>
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

        {/* AI Authorship Review — staff only */}
        {user && ["admin", "master_admin", "editor", "moderator"].includes(user.role) && (
          <AiReviewCard
            contentType="video"
            contentId={video.id}
            data={{
              creationMethod: ((video as any).creationMethod ?? "unclassified") as CreationMethod,
              creatorSelectedTag: (video as any).creatorSelectedTag ?? null,
              platformAssignedTag: (video as any).platformAssignedTag ?? null,
              effectiveDisplayTag: (video as any).effectiveDisplayTag ?? null,
              tagSource: (video as any).tagSource ?? null,
              tagLocked: (video as any).tagLocked ?? false,
              aiEstimatePercent: (video as any).aiEstimatePercent ?? null,
              aiConfidenceLevel: (video as any).aiConfidenceLevel ?? null,
              aiRiskLevel: (video as any).aiRiskLevel ?? null,
              aiDetectionReasons: (video as any).aiDetectionReasons ?? null,
              aiReviewStatus: (video as any).aiReviewStatus ?? "not_scanned",
              aiReviewedAt: (video as any).aiReviewedAt ?? null,
              aiOverrideReason: (video as any).aiOverrideReason ?? null,
            }}
            isAdmin={["admin", "master_admin"].includes(user.role)}
            isModerator={user.role === "moderator"}
            onAction={async (action, params) => {
              const token = localStorage.getItem("cotopia_token");
              const res = await fetch(`/api/admin/ai-review/video/${video.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action, ...params }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast({ variant: "destructive", title: "Action failed", description: (err as any).error ?? "Could not apply action" });
                return;
              }
              toast({ title: "Classification updated" });
              queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) });
            }}
            onScanRequest={async () => {
              const token = localStorage.getItem("cotopia_token");
              const res = await fetch(`/api/admin/ai-review/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ contentType: "video", contentId: video.id }),
              });
              if (!res.ok) {
                toast({ variant: "destructive", title: "Scan request failed" });
                return;
              }
              toast({ title: "Scan queued", description: "Results will appear once the scan completes." });
              setTimeout(() => queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) }), 3000);
            }}
          />
        )}

        {/* Comments */}
        <div className="bg-card border border-border rounded-xl p-5">
          <CommentSection contentType="video" contentId={video.id} />
        </div>
      </div>
      {thumbCropUrl && (
        <ImageCropModal
          imageUrl={thumbCropUrl}
          aspectRatio={16 / 9}
          title="Crop Thumbnail"
          outputSize={1280}
          onConfirm={handleThumbCropConfirm}
          onCancel={() => { URL.revokeObjectURL(thumbCropUrl); setThumbCropUrl(null); }}
        />
      )}
    </div>
  );
}
