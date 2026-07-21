import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/lib/useUpload";
import { ImageCropModal } from "@/components/image-crop-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink, UserPlus, X, Search, Loader2, Upload, Save, Users, Settings,
} from "lucide-react";

function authHeaders() {
  const token = localStorage.getItem("cotopia_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface LabelArtist {
  id: number;
  stageName: string;
  avatarUrl: string | null;
  genre: string | null;
}

interface LabelProfile {
  id: number;
  userId: number;
  name: string;
  bio: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  artists: LabelArtist[];
}

interface SearchArtist {
  id: number;
  stageName: string;
  avatarUrl: string | null;
  labelId: number | null;
}

export default function LabelDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [label, setLabel] = useState<LabelProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAddArtist, setShowAddArtist] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [rosterBusy, setRosterBusy] = useState<number | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [logoFilename, setLogoFilename] = useState("");
  const [bannerFilename, setBannerFilename] = useState("");

  const { uploadFile: uploadLogo, isUploading: isUploadingLogo, progress: logoProgress } = useUpload({
    onSuccess: (res) => setLogoUrl(`/api/storage${res.objectPath}`),
  });

  const { uploadFile: uploadBanner, isUploading: isUploadingBanner, progress: bannerProgress } = useUpload({
    onSuccess: (res) => setBannerUrl(`/api/storage${res.objectPath}`),
  });

  const [logoCropUrl, setLogoCropUrl] = useState<string | null>(null);
  const [logoCropFilename, setLogoCropFilename] = useState("");
  const handleLogoCropConfirm = async (blob: Blob) => {
    if (logoCropUrl) URL.revokeObjectURL(logoCropUrl);
    setLogoCropUrl(null);
    setLogoFilename(logoCropFilename);
    await uploadLogo(new File([blob], "logo.jpg", { type: "image/jpeg" }));
  };

  const [bannerCropUrl, setBannerCropUrl] = useState<string | null>(null);
  const [bannerCropFilename, setBannerCropFilename] = useState("");
  const handleBannerCropConfirm = async (blob: Blob) => {
    if (bannerCropUrl) URL.revokeObjectURL(bannerCropUrl);
    setBannerCropUrl(null);
    setBannerFilename(bannerCropFilename);
    await uploadBanner(new File([blob], "banner.jpg", { type: "image/jpeg" }));
  };

  useEffect(() => {
    if (!user) return;
    fetch("/api/label/me", { headers: authHeaders() })
      .then(r => r.json())
      .then((data: LabelProfile) => {
        setLabel(data);
        setName(data.name ?? "");
        setBio(data.bio ?? "");
        setLogoUrl(data.logoUrl ?? "");
        setBannerUrl(data.bannerUrl ?? "");
      })
      .catch(() => toast({ title: "Failed to load label profile", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!label) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/labels/${label.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name, bio: bio || null, logoUrl: logoUrl || null, bannerUrl: bannerUrl || null }),
      });
      if (!res.ok) throw new Error();
      const updated: LabelProfile = await res.json();
      setLabel(prev => prev ? { ...prev, name: updated.name, bio: updated.bio, logoUrl: updated.logoUrl, bannerUrl: updated.bannerUrl } : prev);
      toast({ title: "Profile saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const searchArtists = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/artists?q=${encodeURIComponent(q)}&limit=10`, { headers: authHeaders() });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addArtist = async (artistId: number) => {
    if (!label) return;
    setRosterBusy(artistId);
    try {
      await fetch(`/api/labels/${label.id}/artists`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ artistId }),
      });
      const res = await fetch("/api/label/me", { headers: authHeaders() });
      const updated: LabelProfile = await res.json();
      setLabel(updated);
      setSearchResults(prev => prev.filter(a => a.id !== artistId));
      toast({ title: "Artist added to roster" });
    } catch {
      toast({ title: "Failed to add artist", variant: "destructive" });
    } finally {
      setRosterBusy(null);
    }
  };

  const removeArtist = async (artistId: number) => {
    if (!label) return;
    setRosterBusy(artistId);
    try {
      await fetch(`/api/labels/${label.id}/artists/${artistId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setLabel(prev => prev ? { ...prev, artists: prev.artists.filter(a => a.id !== artistId) } : prev);
      toast({ title: "Artist removed from roster" });
    } catch {
      toast({ title: "Failed to remove artist", variant: "destructive" });
    } finally {
      setRosterBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 mt-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!label) {
    return (
      <div className="max-w-3xl mx-auto mt-16 text-center text-muted-foreground">
        <p>No label profile found for your account.</p>
      </div>
    );
  }

  const rosterArtistIds = new Set(label.artists.map(a => a.id));

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{label.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Label Dashboard</p>
        </div>
        <Link href={`/labels/${label.id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="w-3.5 h-3.5" />
            View Public Page
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1 gap-2">
            <Settings className="w-3.5 h-3.5" />
            Label Profile
          </TabsTrigger>
          <TabsTrigger value="roster" className="flex-1 gap-2">
            <Users className="w-3.5 h-3.5" />
            Roster ({label.artists.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="text-base font-semibold">Label Profile</h2>

            <div className="space-y-2">
              <label htmlFor="label-name" className="text-sm font-medium">Label Name</label>
              <Input
                id="label-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your label name"
                className="bg-secondary/50 border-secondary"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="label-bio" className="text-sm font-medium">Bio <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Textarea
                id="label-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell artists and creators about your label…"
                rows={4}
                className="bg-secondary/50 border-secondary resize-none"
              />
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoCropFilename(file.name);
                  setLogoCropUrl(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
              <div
                onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all cursor-pointer ${isUploadingLogo ? "cursor-wait opacity-70" : ""}`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUploadingLogo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  {isUploadingLogo
                    ? <p className="text-sm">Uploading… {logoProgress}%</p>
                    : logoFilename && logoUrl
                      ? <p className="text-sm truncate text-green-400">{logoFilename} ✓</p>
                      : logoUrl
                        ? <p className="text-xs text-muted-foreground truncate">{logoUrl}</p>
                        : <p className="text-sm">Click to upload logo</p>
                  }
                </div>
              </div>
            </div>

            {/* Banner upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Banner <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBannerCropFilename(file.name);
                  setBannerCropUrl(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
              <div
                onClick={() => !isUploadingBanner && bannerInputRef.current?.click()}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all cursor-pointer ${isUploadingBanner ? "cursor-wait opacity-70" : ""}`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUploadingBanner ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  {isUploadingBanner
                    ? <p className="text-sm">Uploading… {bannerProgress}%</p>
                    : bannerFilename && bannerUrl
                      ? <p className="text-sm truncate text-green-400">{bannerFilename} ✓</p>
                      : bannerUrl
                        ? <p className="text-xs text-muted-foreground truncate">{bannerUrl}</p>
                        : <p className="text-sm">Click to upload banner</p>
                  }
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Roster Tab ── */}
        <TabsContent value="roster" className="mt-4 space-y-4">
          {/* Add artist panel */}
          <div className="bg-card rounded-xl border border-border p-4">
            {!showAddArtist ? (
              <Button variant="outline" className="gap-2 w-full" onClick={() => setShowAddArtist(true)}>
                <UserPlus className="w-4 h-4" />
                Add Artist to Roster
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Search artists</p>
                  <button
                    onClick={() => { setShowAddArtist(false); setSearchQuery(""); setSearchResults([]); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Search by artist name"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); searchArtists(e.target.value); }}
                    placeholder="Search by artist name…"
                    className="pl-9 bg-secondary/50 border-secondary"
                    autoFocus
                  />
                </div>
                {searching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {searchResults.map(a => {
                      const onRoster = rosterArtistIds.has(a.id);
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                            {a.avatarUrl
                              ? <img src={a.avatarUrl} alt={a.stageName} className="w-full h-full object-cover" />
                              : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">{a.stageName[0]}</span>
                            }
                          </div>
                          <span className="flex-1 text-sm font-medium truncate">{a.stageName}</span>
                          {onRoster
                            ? <span className="text-xs text-muted-foreground">On roster</span>
                            : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => addArtist(a.id)}
                                disabled={rosterBusy === a.id}
                              >
                                {rosterBusy === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                              </Button>
                            )
                          }
                        </div>
                      );
                    })}
                  </div>
                )}
                {!searching && searchQuery.length > 1 && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No artists found.</p>
                )}
              </div>
            )}
          </div>

          {/* Current roster */}
          {label.artists.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No artists on your roster yet.</p>
              <p className="text-xs mt-1">Use the button above to add artists.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {label.artists.map(artist => (
                <div key={artist.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                    {artist.avatarUrl
                      ? <img src={artist.avatarUrl} alt={artist.stageName} className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">{artist.stageName[0]}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/artists/${artist.id}`}>
                      <p className="text-sm font-semibold hover:text-primary transition-colors truncate">{artist.stageName}</p>
                    </Link>
                    {artist.genre && <p className="text-xs text-muted-foreground">{artist.genre}</p>}
                  </div>
                  <button
                    onClick={() => removeArtist(artist.id)}
                    disabled={rosterBusy === artist.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove from roster"
                  >
                    {rosterBusy === artist.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <X className="w-4 h-4" />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {logoCropUrl && (
        <ImageCropModal
          imageUrl={logoCropUrl}
          aspectRatio={1}
          title="Crop Logo"
          outputSize={800}
          onConfirm={handleLogoCropConfirm}
          onCancel={() => { URL.revokeObjectURL(logoCropUrl); setLogoCropUrl(null); }}
        />
      )}
      {bannerCropUrl && (
        <ImageCropModal
          imageUrl={bannerCropUrl}
          aspectRatio={3}
          title="Crop Banner"
          outputSize={1500}
          onConfirm={handleBannerCropConfirm}
          onCancel={() => { URL.revokeObjectURL(bannerCropUrl); setBannerCropUrl(null); }}
        />
      )}
    </div>
  );
}
