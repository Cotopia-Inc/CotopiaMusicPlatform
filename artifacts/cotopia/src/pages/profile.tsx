import { useGetMe, getGetMeQueryKey, useUpdateMe, useChangePassword, useChangeUsername, useSendOtp, useVerifyOtp } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Loader2, Lock, User, MailCheck, CheckCircle, Mail, RefreshCw, Film, Camera } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { RoleBadges, VerifiedBadge } from "@/components/role-badges";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ImageCropModal } from "@/components/image-crop-modal";

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useGetMe({
    query: { enabled: !!user, queryKey: getGetMeQueryKey() }
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFilename, setAvatarFilename] = useState("");
  const [avatarUrlMode, setAvatarUrlMode] = useState(false);
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
      onError: (err: any) => toast({ variant: "destructive", title: err?.response?.data?.error ?? "Incorrect current password" }),
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
      onError: (err: any) => toast({ variant: "destructive", title: err?.response?.data?.error ?? "Username already taken" }),
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
      onError: (err: any) => toast({ variant: "destructive", title: err?.response?.data?.error ?? "Could not send code" }),
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
      onError: (err: any) => toast({ variant: "destructive", title: err?.response?.data?.error ?? "Incorrect or expired code" }),
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
      </div>

      {/* Email verification banner */}
      {!emailVerified && (
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

      {/* Profile Settings */}
      <div className="space-y-6 bg-card p-8 rounded-xl border border-border">
        <h2 className="text-xl font-bold">Profile Settings</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Display Name</label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-secondary/50 border-secondary" />
        </div>

        {/* Avatar upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Picture</label>
          {!avatarUrlMode ? (
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
              <button type="button" onClick={() => setAvatarUrlMode(true)} className="text-xs text-primary hover:underline">Or paste a URL instead</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input value={avatarUrl.startsWith("/api/storage") ? "" : avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://... (direct image URL)" className="bg-secondary/50 border-secondary" />
              <button type="button" onClick={() => setAvatarUrlMode(false)} className="text-xs text-primary hover:underline">← Upload from device instead</button>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bio <span className="text-muted-foreground text-xs">(optional)</span></label>
          <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell listeners about yourself…" rows={4} className="bg-secondary/50 border-secondary resize-none" />
        </div>

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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">or paste URL:</span>
                <Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." className="bg-secondary/50 border-secondary h-8 text-xs flex-1" />
              </div>
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
