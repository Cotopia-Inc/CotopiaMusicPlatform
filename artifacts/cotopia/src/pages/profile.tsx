import { useGetMe, getGetMeQueryKey, useUpdateMe, useChangePassword, useChangeUsername, useSendOtp, useVerifyOtp, useGetMySettings, getGetMySettingsQueryKey, useUpdateMySettings, type UserSettingsUpdate } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BadgeList, type UserBadgeData } from "@/components/badge-chip";
import { useAuth } from "@/lib/auth";
import { usePlatformConfig } from "@/lib/platform-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Loader2, Lock, User, MailCheck, CheckCircle, Mail, RefreshCw, Film, Camera, Trash2, AlertTriangle, GripVertical } from "lucide-react";
import { useUpload } from "@/lib/useUpload";
import { RoleBadges, VerifiedBadge } from "@/components/role-badges";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ImageCropModal } from "@/components/image-crop-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsTab } from "@/components/events-tab";
import { CreatorSupportSettings } from "@/components/creator-support-settings";

function FeaturedBadgesSection({ userId }: { userId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const badgesQueryKey = ["user-badges", userId];
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [liveOrder, setLiveOrder] = useState<number[] | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const liveOrderRef = useRef<number[] | null>(null);
  const draggedIdRef = useRef<number | null>(null);

  const { data: userBadges } = useQuery<UserBadgeData[]>({
    queryKey: badgesQueryKey,
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/${userId}/badges`);
      return res.ok ? res.json() : [];
    },
    enabled: !!userId,
  });

  const featuredMutation = useMutation({
    mutationFn: async (badgeIds: number[]) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/${userId}/featured-badges`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ badgeIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: badgesQueryKey });
      toast({ title: "Featured badges updated" });
    },
    onError: (e: unknown) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Update failed" }),
  });

  const activeBadges = (userBadges ?? []).filter(ub => ub.badge.isActive && ub.badge.isVisible);
  const serverFeaturedIds = (userBadges ?? [])
    .filter(ub => ub.isFeatured)
    .sort((a, b) => (a.featureOrder ?? 99) - (b.featureOrder ?? 99))
    .map(ub => ub.badgeId);

  // While dragging, show the in-progress order; otherwise reflect the server order.
  const featuredIds = liveOrder ?? serverFeaturedIds;

  // Featured badges are shown first (in feature order), unfeatured badges follow in their
  // original (award date) order. This makes reordering visibly move rows, not just labels.
  const sortedBadges = [...activeBadges].sort((a, b) => {
    const aIdx = featuredIds.indexOf(a.badgeId);
    const bIdx = featuredIds.indexOf(b.badgeId);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  function toggleFeatured(badgeId: number) {
    const newIds = serverFeaturedIds.includes(badgeId)
      ? serverFeaturedIds.filter(id => id !== badgeId)
      : [...serverFeaturedIds, badgeId];
    featuredMutation.mutate(newIds);
  }

  // Drag state is tracked with window-level pointer listeners (rather than per-element
  // pointer capture) because reordering the list moves the dragged DOM node during the
  // drag itself, and browsers silently release captured pointers when their target node
  // is detached/reinserted mid-gesture. Window listeners keep receiving events regardless.
  useEffect(() => {
    if (draggedId === null) return;

    function findClosestId(y: number): number | null {
      let closestId: number | null = null;
      let closestDist = Infinity;
      itemRefs.current.forEach((el, id) => {
        if (!(liveOrderRef.current ?? serverFeaturedIds).includes(id)) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - y);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });
      return closestId;
    }

    function onMove(e: PointerEvent) {
      const currentDraggedId = draggedIdRef.current;
      if (currentDraggedId === null) return;
      e.preventDefault();
      const closestId = findClosestId(e.clientY);
      if (closestId !== null && closestId !== currentDraggedId) {
        setLiveOrder(prev => {
          const cur = prev ?? serverFeaturedIds;
          const fromIdx = cur.indexOf(currentDraggedId);
          const toIdx = cur.indexOf(closestId);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return cur;
          const next = [...cur];
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, currentDraggedId);
          return next;
        });
      }
    }

    function onUp() {
      const finalOrder = liveOrderRef.current;
      if (finalOrder && JSON.stringify(finalOrder) !== JSON.stringify(serverFeaturedIds)) {
        featuredMutation.mutate(finalOrder);
      }
      setDraggedId(null);
      setLiveOrder(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedId]);

  useEffect(() => {
    liveOrderRef.current = liveOrder;
  }, [liveOrder]);

  useEffect(() => {
    draggedIdRef.current = draggedId;
  }, [draggedId]);

  function handlePointerDown(e: React.PointerEvent, badgeId: number) {
    if (!serverFeaturedIds.includes(badgeId)) return;
    e.preventDefault();
    setDraggedId(badgeId);
    setLiveOrder(serverFeaturedIds);
    liveOrderRef.current = serverFeaturedIds;
    draggedIdRef.current = badgeId;
  }

  if (activeBadges.length === 0) return null;

  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium">Featured Badges</label>
        <p className="text-xs text-muted-foreground mt-0.5">Choose which badges to highlight on your public profile. Drag the handle to reorder.</p>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {sortedBadges.map(ub => {
          const isFeatured = serverFeaturedIds.includes(ub.badgeId);
          const order = featuredIds.indexOf(ub.badgeId);
          const isDragging = draggedId === ub.badgeId;
          return (
            <div
              key={ub.id}
              ref={(el) => {
                if (el) itemRefs.current.set(ub.badgeId, el);
                else itemRefs.current.delete(ub.badgeId);
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                isFeatured
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border/80 hover:bg-secondary/30"
              } ${isDragging ? "opacity-40 shadow-lg" : ""}`}
              style={{ transition: "opacity 0.15s" }}
            >
              {isFeatured && (
                <button
                  type="button"
                  onPointerDown={(e) => handlePointerDown(e, ub.badgeId)}
                  onClick={(e) => e.preventDefault()}
                  className="flex-shrink-0 text-primary/70 cursor-grab active:cursor-grabbing touch-none select-none p-1 -m-1"
                  style={{ touchAction: "none" }}
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => toggleFeatured(ub.badgeId)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-not-allowed"
              >
                <span className="text-lg flex-shrink-0">{ub.badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{ub.badge.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ub.badge.description}</p>
                </div>
              </button>
              {isFeatured && (
                <span className="text-xs font-semibold text-primary flex-shrink-0">#{order + 1}</span>
              )}
            </div>
          );
        })}
      </div>
      {activeBadges.length > 0 && (
        <div className="pt-1">
          <BadgeList userBadges={(userBadges ?? []).filter(ub => ub.isFeatured).sort((a, b) => (a.featureOrder ?? 99) - (b.featureOrder ?? 99))} size="md" />
        </div>
      )}
    </div>
  );
}

function DangerZone({ profile }: { profile: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const pending = !!(profile as any).deletionRequestedAt;

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/me/deletion-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Request failed");
      toast({ title: "Deletion request submitted", description: "A master admin will review your request and contact you." });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setShowDialog(false);
      setConfirmed(false);
    } catch {
      toast({ variant: "destructive", title: "Could not submit deletion request" });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/me/deletion-request`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Cancel failed");
      toast({ title: "Deletion request cancelled", description: "Your account will not be deleted." });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast({ variant: "destructive", title: "Could not cancel deletion request" });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
    <div className="bg-card p-6 rounded-xl border border-red-500/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-sm text-red-300">Delete Account</p>
          <p className="text-xs text-muted-foreground">Permanently remove your account and all associated data.</p>
        </div>
      </div>

      {pending ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300 space-y-1">
              <p className="font-semibold">Deletion request pending review</p>
              <p className="text-amber-300/80">Your request is awaiting approval from a master admin. You can cancel it any time before they act on it.</p>
              {(profile as any).deletionRequestedAt && (
                <p className="text-amber-300/60">Submitted: {new Date((profile as any).deletionRequestedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
            className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            {isCancelling ? "Cancelling…" : "Cancel Deletion Request"}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDialog(true)}
          className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Request Account Deletion
        </Button>
      )}
    </div>

    <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setConfirmed(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Request Account Deletion
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This will submit a deletion request to the master admin. Once approved, your account, content, playlists, and all associated data will be <span className="text-foreground font-semibold">permanently erased</span> and cannot be recovered.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
            <p className="text-xs text-red-400 font-semibold">What gets deleted:</p>
            <ul className="text-xs text-red-400/80 list-disc list-inside space-y-0.5">
              <li>Your profile and all account data</li>
              <li>All uploaded songs, videos, and albums</li>
              <li>Your playlists, favorites, and play history</li>
              <li>All messages and comments</li>
            </ul>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              I understand this is permanent and irreversible. I want to request deletion of my account.
            </span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setShowDialog(false); setConfirmed(false); }} disabled={isRequesting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRequest}
            disabled={!confirmed || isRequesting}
            className="gap-2"
          >
            {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isRequesting ? "Submitting…" : "Submit Deletion Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const config = usePlatformConfig();
  const { data: profile, isLoading } = useGetMe({
    query: { enabled: !!user, queryKey: getGetMeQueryKey() }
  });

  const { data: myBadges } = useQuery<UserBadgeData[]>({
    queryKey: ["user-badges", user?.id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/${user!.id}/badges`);
      return res.ok ? res.json() : [];
    },
    enabled: !!user?.id,
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFilename, setAvatarFilename] = useState("");
  const [bio, setBio] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [profileVideoUrl, setProfileVideoUrl] = useState("");
  const [cropModal, setCropModal] = useState<{ url: string; mode: "avatar" | "banner" } | null>(null);
  const initialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Username change
  const [newUsername, setNewUsername] = useState("");
  const [showUsernameForm, setShowUsernameForm] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Email change
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (profile && !initialized.current) {
      setDisplayName(profile.displayName || "");
      setAvatarUrl(profile.avatarUrl || "");
      setBio((profile as any).bio || "");
      setBannerUrl((profile as any).bannerUrl || "");
      setProfileVideoUrl((profile as any).profileVideoUrl || "");
      setNewUsername(profile.username || "");
      initialized.current = true;
    }
  }, [profile]);

  const [messagePolicy, setMessagePolicy] = useState<string>("followers_only");
  const { data: pmSettings } = useGetMySettings({
    query: { enabled: !!user, queryKey: getGetMySettingsQueryKey() },
  });
  useEffect(() => {
    if (pmSettings?.messagePolicy) setMessagePolicy(pmSettings.messagePolicy);
  }, [pmSettings]);

  const savePolicyMutation = useUpdateMySettings({
    mutation: {
      onSuccess: () => toast({ title: "Message settings saved" }),
      onError: () => toast({ variant: "destructive", title: "Could not save settings" }),
    },
  });
  const savingPolicy = savePolicyMutation.isPending;

  const handleSavePolicy = () => {
    savePolicyMutation.mutate({
      data: { messagePolicy: messagePolicy as UserSettingsUpdate["messagePolicy"] },
    });
  };

  const updateMutation = useUpdateMe();
  const changePasswordMutation = useChangePassword();
  const changeUsernameMutation = useChangeUsername();
  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();

  const { uploadFile: uploadAvatar, isUploading: isUploadingAvatar, progress: uploadProgress } = useUpload({
    onSuccess: (res) => setAvatarUrl(`/api/storage${res.objectPath}`),
  });

  const { uploadFile: uploadBanner, isUploading: isUploadingBanner, progress: bannerProgress } = useUpload({
    onSuccess: (res) => setBannerUrl(`/api/storage${res.objectPath}`),
  });

  const { uploadFile: uploadVideo, isUploading: isUploadingVideo, progress: videoProgress } = useUpload({
    onSuccess: (res) => setProfileVideoUrl(`/api/storage${res.objectPath}`),
  });

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadVideo(file);
    e.target.value = "";
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFilename(file.name);
    setCropModal({ url: URL.createObjectURL(file), mode: "avatar" });
    e.target.value = "";
  };

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropModal({ url: URL.createObjectURL(file), mode: "banner" });
    e.target.value = "";
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!cropModal) return;
    const { mode, url } = cropModal;
    URL.revokeObjectURL(url);
    setCropModal(null);
    const file = new File([blob], mode === "avatar" ? "avatar.jpg" : "banner.jpg", { type: "image/jpeg" });
    if (mode === "avatar") {
      await uploadAvatar(file);
    } else {
      await uploadBanner(file);
    }
  };

  const handleCapturePosterFrame = () => {
    const video = videoPreviewRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], "poster.jpg", { type: "image/jpeg" });
        await uploadBanner(file);
        toast({ title: "Frame captured", description: "Set as your profile banner." });
      },
      "image/jpeg",
      0.92,
    );
  };

  const clearAvatar = () => {
    setAvatarUrl("");
    setAvatarFilename("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    updateMutation.mutate({ data: { displayName, avatarUrl, bio, bannerUrl, profileVideoUrl } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ variant: "destructive", title: "Update failed" }),
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "New password must be at least 6 characters" });
      return;
    }
    changePasswordMutation.mutate({ data: { currentPassword, newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password changed", description: "Your password has been updated." });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setShowPasswordForm(false);
      },
      onError: (err: any) => toast({ variant: "destructive", title: err?.data?.error ?? "Incorrect current password" }),
    });
  };

  const handleChangeUsername = () => {
    if (!newUsername.trim() || newUsername === profile?.username) return;
    changeUsernameMutation.mutate({ data: { username: newUsername.trim() } }, {
      onSuccess: (updatedUser) => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Username updated" });
        setShowUsernameForm(false);
      },
      onError: (err: any) => toast({ variant: "destructive", title: err?.data?.error ?? "Username already taken" }),
    });
  };

  function startEmailCountdown() {
    setEmailCountdown(60);
    emailTimerRef.current = setInterval(() => {
      setEmailCountdown(c => {
        if (c <= 1) { clearInterval(emailTimerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  const handleSendEmailCode = () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      toast({ variant: "destructive", title: "Enter a valid email address" });
      return;
    }
    if (newEmail.trim().toLowerCase() === profile?.email?.toLowerCase()) {
      toast({ variant: "destructive", title: "That's already your current email" });
      return;
    }
    sendOtpMutation.mutate({ data: { purpose: "change_email", newEmail: newEmail.trim() } }, {
      onSuccess: () => {
        setEmailStep(2);
        startEmailCountdown();
        toast({ title: "Code sent", description: `A 6-digit code was sent to ${newEmail.trim()}.` });
      },
      onError: (err: any) => toast({ variant: "destructive", title: err?.data?.error ?? "Could not send code" }),
    });
  };

  const handleVerifyEmailCode = () => {
    if (emailCode.length !== 6) { toast({ variant: "destructive", title: "Enter the 6-digit code" }); return; }
    verifyOtpMutation.mutate({ data: { purpose: "change_email", code: emailCode.trim(), newEmail: newEmail.trim() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Email updated", description: "Your email address has been changed." });
        setShowEmailForm(false);
        setEmailStep(1);
        setNewEmail("");
        setEmailCode("");
      },
      onError: (err: any) => toast({ variant: "destructive", title: err?.data?.error ?? "Incorrect or expired code" }),
    });
  };

  const handleSendVerification = () => {
    sendOtpMutation.mutate({ data: { purpose: "verify_email" } }, {
      onSuccess: () => {
        toast({ title: "Verification email sent", description: "Check your inbox." });
        setLocation("/verify-email");
      },
      onError: () => toast({ variant: "destructive", title: "Could not send verification email" }),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 mt-12">
        <Skeleton className="w-32 h-32 rounded-full mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
      </div>
    );
  }

  if (!profile) return <div>Not authenticated</div>;

  const emailVerified = (profile as any).emailVerified;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      {/* Avatar + name header */}
      <div className="text-center space-y-4">
        <div className="relative w-32 h-32 mx-auto">
          <div className="w-full h-full rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{profile.username[0].toUpperCase()}</span>
            )}
          </div>
          {profile.isVerified && (
            <div className="absolute bottom-1 right-1 bg-background rounded-full p-0.5 shadow-lg">
              <VerifiedBadge role={profile.role} size="lg" isVerified={profile.isVerified} />
            </div>
          )}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2 flex-wrap">
          {profile.username}
          <RoleBadges role={profile.role} isVerified={profile.isVerified} size="lg" />
        </h1>
        <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">{profile.role?.replace("_", " ")}</p>
        {myBadges && myBadges.length > 0 && (
          <div className="flex justify-center">
            <BadgeList
              userBadges={[...myBadges].sort((a, b) => {
                const aFeatured = a.isFeatured ? 0 : 1;
                const bFeatured = b.isFeatured ? 0 : 1;
                if (aFeatured !== bFeatured) return aFeatured - bFeatured;
                if (a.isFeatured && b.isFeatured) {
                  return (a.featureOrder ?? 99) - (b.featureOrder ?? 99);
                }
                return 0;
              })}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Email verification banner */}
      {config.requireEmailVerification && !emailVerified && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <MailCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Email not verified</p>
              <p className="text-xs text-muted-foreground">Verify your email to secure your account</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleSendVerification} disabled={sendOtpMutation.isPending} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 flex-shrink-0">
            {sendOtpMutation.isPending ? "Sending…" : "Verify Now"}
          </Button>
        </div>
      )}

      {/* Settings / Events */}
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Profile Settings</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="pt-6">
          <EventsTab userId={(profile as any).id} isOwner />
        </TabsContent>
        <TabsContent value="settings" className="pt-6 space-y-8">
      {/* Profile Settings */}
      <div className="space-y-6 bg-card p-4 md:p-8 rounded-xl border border-border">
        <h2 className="text-xl font-bold">Profile Settings</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Display Name</label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-secondary/50 border-secondary" />
        </div>

        {/* Avatar upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Picture</label>
          <div className="space-y-2">
            <div onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all group ${isUploadingAvatar ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                {isUploadingAvatar ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                {isUploadingAvatar ? (
                  <div><p className="text-sm font-medium text-foreground truncate">{avatarFilename}</p><p className="text-xs text-primary mt-0.5">Uploading… {uploadProgress}%</p></div>
                ) : avatarFilename && avatarUrl ? (
                  <div><p className="text-sm font-medium text-foreground truncate">{avatarFilename}</p><p className="text-xs text-green-400 mt-0.5">Uploaded ✓</p></div>
                ) : (
                  <div><p className="text-sm font-medium">Click to upload from device</p><p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WebP</p></div>
                )}
              </div>
              {avatarFilename && avatarUrl && !isUploadingAvatar && (
                <button type="button" onClick={e => { e.stopPropagation(); clearAvatar(); }} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-secondary transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" disabled={isUploadingAvatar} />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bio <span className="text-muted-foreground text-xs">(optional)</span></label>
          <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell creators about yourself…" rows={4} className="bg-secondary/50 border-secondary resize-none" />
        </div>

        {/* Featured Badges */}
        {profile && <FeaturedBadgesSection userId={(profile as any).id} />}

        {/* Banner Image */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Banner <span className="text-muted-foreground text-xs">(optional)</span></label>
          {bannerUrl ? (
            <div className="space-y-2">
              <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border">
                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setBannerUrl("")} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div onClick={() => !isUploadingBanner && bannerInputRef.current?.click()}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all group ${isUploadingBanner ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUploadingBanner ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  {isUploadingBanner ? <p className="text-xs text-primary">Uploading… {bannerProgress}%</p> : (
                    <><p className="text-sm font-medium">Click to upload banner image</p><p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP — wide/landscape</p></>
                  )}
                </div>
              </div>
              <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerFile} className="hidden" disabled={isUploadingBanner} />
            </div>
          )}
        </div>

        {/* Profile Video */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Video <span className="text-muted-foreground text-xs">(optional — plays in your banner area, visible to everyone)</span></label>
          <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoFile} className="hidden" disabled={isUploadingVideo} />
          <div
            onClick={() => !isUploadingVideo && videoInputRef.current?.click()}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all group ${isUploadingVideo ? "cursor-wait opacity-70" : "cursor-pointer"}`}
          >
            {isUploadingVideo ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            ) : (
              <Film className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {isUploadingVideo ? (
                <p className="text-sm text-primary">Uploading… {videoProgress}%</p>
              ) : profileVideoUrl && profileVideoUrl.startsWith("/api/storage") ? (
                <p className="text-sm text-green-400 truncate">Video uploaded ✓</p>
              ) : (
                <p className="text-sm text-muted-foreground">Click to upload a video from your device</p>
              )}
              <p className="text-xs text-muted-foreground/60">MP4, MOV, WebM accepted</p>
            </div>
            {profileVideoUrl && !isUploadingVideo && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setProfileVideoUrl(""); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                title="Remove video"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">or paste URL:</span>
            <Input value={profileVideoUrl} onChange={e => setProfileVideoUrl(e.target.value)} placeholder="https://... (YouTube, Vimeo, or MP4)" className="bg-secondary/50 border-secondary h-8 text-xs flex-1" />
          </div>
          {/* Video preview */}
          {profileVideoUrl && (
            <div className="space-y-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-black border border-border relative group">
                <video
                  ref={videoPreviewRef}
                  key={profileVideoUrl}
                  src={profileVideoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleCapturePosterFrame}
                  title="Capture current frame as banner"
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-white/20"
                >
                  <Camera className="w-3.5 h-3.5" />Capture frame as banner
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Pause the video on any frame and click "Capture frame as banner" to use it as your profile banner.</p>
            </div>
          )}
        </div>

        {/* Email (read-only with verification status) */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            Email
            {emailVerified
              ? <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-2.5 h-2.5 mr-1" />Verified</Badge>
              : <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">Unverified</Badge>
            }
          </label>
          <Input value={profile.email} disabled className="bg-secondary/20 border-secondary text-muted-foreground" />
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* Private Message Settings */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Private Messages</p>
            <p className="text-xs text-muted-foreground">Choose who is allowed to send you direct messages.</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Who can message me</label>
          <Select value={messagePolicy} onValueChange={setMessagePolicy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="followers_only">Followers only</SelectItem>
              <SelectItem value="verified_only">Verified users only</SelectItem>
              <SelectItem value="nobody">No one</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSavePolicy} disabled={savingPolicy} variant="outline" className="w-full">
          {savingPolicy ? "Saving…" : "Save Message Settings"}
        </Button>
      </div>

      {/* Change Username */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Username</p>
              <p className="text-xs text-muted-foreground">Current: <span className="font-mono text-foreground">@{profile.username}</span></p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowUsernameForm(v => !v)}>
            {showUsernameForm ? "Cancel" : "Change"}
          </Button>
        </div>

        {showUsernameForm && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Username</label>
              <Input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="new_username"
                className="bg-secondary/50 border-secondary font-mono"
              />
              <p className="text-xs text-muted-foreground">Only letters, numbers, underscores, dots, and hyphens. Must be unique.</p>
            </div>
            <Button onClick={handleChangeUsername} disabled={changeUsernameMutation.isPending || !newUsername.trim() || newUsername === profile.username} size="sm">
              {changeUsernameMutation.isPending ? "Saving…" : "Save Username"}
            </Button>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Password</p>
              <p className="text-xs text-muted-foreground">Update your account password</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(v => !v)}>
            {showPasswordForm ? "Cancel" : "Change"}
          </Button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-secondary" onKeyDown={e => e.key === "Enter" && handleChangePassword()} />
            </div>
            <Button onClick={handleChangePassword} disabled={changePasswordMutation.isPending || !currentPassword || !newPassword} size="sm">
              {changePasswordMutation.isPending ? "Updating…" : "Update Password"}
            </Button>
          </div>
        )}
      </div>

      {/* Change Email */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Email Address</p>
              <p className="text-xs text-muted-foreground font-mono">{profile.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setShowEmailForm(v => !v); setEmailStep(1); setNewEmail(""); setEmailCode(""); }}>
            {showEmailForm ? "Cancel" : "Change"}
          </Button>
        </div>

        {showEmailForm && emailStep === 1 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Email Address</label>
              <Input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                className="bg-secondary/50 border-secondary"
                onKeyDown={e => e.key === "Enter" && handleSendEmailCode()}
              />
              <p className="text-xs text-muted-foreground">A 6-digit verification code will be sent to this address.</p>
            </div>
            <Button onClick={handleSendEmailCode} disabled={sendOtpMutation.isPending || !newEmail.trim()} size="sm">
              {sendOtpMutation.isPending ? "Sending…" : "Send Verification Code"}
            </Button>
          </div>
        )}

        {showEmailForm && emailStep === 2 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-semibold text-foreground">{newEmail}</span>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                value={emailCode}
                onChange={e => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="bg-secondary/50 border-secondary h-12 text-center text-2xl tracking-[0.5em] font-mono"
                onKeyDown={e => e.key === "Enter" && handleVerifyEmailCode()}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleVerifyEmailCode} disabled={verifyOtpMutation.isPending || emailCode.length !== 6} size="sm">
                {verifyOtpMutation.isPending ? "Verifying…" : "Confirm Code"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendEmailCode}
                disabled={emailCountdown > 0 || sendOtpMutation.isPending}
                className="text-xs text-muted-foreground gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {emailCountdown > 0 ? `Resend in ${emailCountdown}s` : "Resend"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">(During development, the code is logged to the server console.)</p>
          </div>
        )}
      </div>

      {/* Creator Support — available to any role that wants to accept demo tips */}
      <CreatorSupportSettings />

      {/* Danger Zone — Account Deletion */}
      <DangerZone profile={profile} />
        </TabsContent>
      </Tabs>

      {cropModal && (
        <ImageCropModal
          imageUrl={cropModal.url}
          aspectRatio={cropModal.mode === "avatar" ? 1 : 4}
          circular={cropModal.mode === "avatar"}
          title={cropModal.mode === "avatar" ? "Crop Profile Picture" : "Crop Banner Image"}
          outputSize={cropModal.mode === "avatar" ? 400 : 1200}
          onConfirm={handleCropConfirm}
          onCancel={() => {
            URL.revokeObjectURL(cropModal.url);
            setCropModal(null);
          }}
        />
      )}
    </div>
  );
}
