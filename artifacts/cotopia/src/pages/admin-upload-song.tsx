import { useState, useCallback, useRef, useEffect } from "react";
import { ExperienceFeedbackModal } from "@/components/experience-feedback-modal";
import { useAdminUploadSong, useAdminBulkUploadSongs, useAdminGetUploadAccounts } from "@workspace/api-client-react";
import { useUpload } from "../lib/useUpload";
import { ImageCropModal } from "@/components/image-crop-modal";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Upload, Music, ArrowLeft, CheckCircle, Disc, Disc3, ListMusic, BadgeCheck, X, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const GENRES = ["Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Country", "Reggae", "Latin", "Afrobeats", "Indie", "Alternative", "Metal", "Folk", "Soul", "Blues", "Other"];
const MOODS = ["Energetic", "Chill", "Romantic", "Dark", "Happy", "Melancholic", "Motivational", "Party", "Peaceful", "Nostalgic", "Intense", "Dreamy"];

function getReleaseType(count: number): "single" | "ep" | "album" {
  if (count === 1) return "single";
  if (count <= 6) return "ep";
  return "album";
}

function getReleaseLabel(type: "single" | "ep" | "album") {
  return { single: "Single", ep: "EP", album: "Album" }[type];
}

function getReleaseIcon(type: "single" | "ep" | "album") {
  if (type === "single") return <Music className="w-4 h-4" />;
  if (type === "ep") return <Disc className="w-4 h-4" />;
  return <Disc3 className="w-4 h-4" />;
}

// Individual song row in bulk upload — each has its own upload state
function SongUploadRow({
  file,
  title,
  index,
  onTitleChange,
  onStreamUrlSet,
  onRemove,
}: {
  file: File;
  title: string;
  index: number;
  onTitleChange: (idx: number, title: string) => void;
  onStreamUrlSet: (idx: number, url: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [done, setDone] = useState(false);
  const didUpload = useRef(false);
  const upload = useUpload({
    onSuccess: (res) => {
      const url = `/api/storage${res.objectPath}`;
      setDone(true);
      onStreamUrlSet(index, url);
    },
  });

  useEffect(() => {
    if (!didUpload.current) {
      didUpload.current = true;
      upload.uploadFile(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <span className="text-xs text-muted-foreground w-5 text-center font-bold flex-shrink-0">{index + 1}</span>
      <Input
        aria-label={`Song ${index + 1} title`}
        value={title}
        onChange={e => onTitleChange(index, e.target.value)}
        className="flex-1 h-8 text-sm"
        placeholder="Song title"
      />
      <span className="text-xs text-muted-foreground truncate max-w-[120px] flex-shrink-0" title={file.name}>{file.name}</span>
      {done ? (
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : upload.isUploading ? (
        <div className="flex items-center gap-2 flex-shrink-0 w-24">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${upload.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{upload.progress}%</span>
        </div>
      ) : upload.error ? (
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/40" onClick={() => upload.uploadFile(file)}>
            <AlertCircle className="w-3 h-3 mr-1" />Retry
          </Button>
          <span className="text-[10px] text-destructive max-w-[150px] truncate" title={upload.error.message}>{upload.error.message}</span>
        </div>
      ) : (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
      )}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors ml-1"
        title="Remove file"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AdminUploadSong() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin" && user.role !== "editor") navigate("/");
  }, [user, navigate]);

  // ── Single song form ─────────────────────────────────────────────
  const [form, setForm] = useState({
    title: "",
    userId: 0,
    genre: "",
    mood: "",
    isExplicit: false,
    duration: 0,
    streamUrl: "",
    coverUrl: "",
    releaseDate: "",
    isFeatured: false,
    lyrics: "",
    credits: "",
  });
  const [singleDone, setSingleDone] = useState<{ id: number; title: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const audioUpload = useUpload({
    onSuccess: (res) => setForm(f => ({ ...f, streamUrl: `/api/storage${res.objectPath}` })),
  });
  const coverUpload = useUpload({
    onSuccess: (res) => setForm(f => ({ ...f, coverUrl: `/api/storage${res.objectPath}` })),
  });
  const [coverCropUrl, setCoverCropUrl] = useState<string | null>(null);
  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCoverCropUrl(URL.createObjectURL(f));
    e.target.value = "";
  };
  const handleCoverCropConfirm = async (blob: Blob) => {
    if (coverCropUrl) URL.revokeObjectURL(coverCropUrl);
    setCoverCropUrl(null);
    await coverUpload.uploadFile(new File([blob], "cover.jpg", { type: "image/jpeg" }));
  };

  const uploadSong = useAdminUploadSong();

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.userId || !form.streamUrl) {
      toast({ title: "Missing required fields", description: "Title, artist, and audio file are required", variant: "destructive" });
      return;
    }
    try {
      const song = await uploadSong.mutateAsync({
        data: {
          title: form.title,
          userId: form.userId,
          genre: form.genre || undefined,
          mood: form.mood || undefined,
          isExplicit: form.isExplicit,
          duration: form.duration || undefined,
          streamUrl: form.streamUrl,
          coverUrl: form.coverUrl || undefined,
          releaseDate: form.releaseDate || undefined,
          releaseType: "single",
          isFeatured: form.isFeatured,
          lyrics: form.lyrics || undefined,
          credits: form.credits || undefined,
        },
      });
      setSingleDone({ id: song.id, title: song.title });
      toast({ title: "Song uploaded for review", description: `"${song.title}" is waiting in Admin › Submissions for your approval` });
      setFeedbackOpen(true);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Unknown error", variant: "destructive" });
    }
  }

  // ── Bulk upload form ─────────────────────────────────────────────
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkTitles, setBulkTitles] = useState<string[]>([]);
  const [bulkUrls, setBulkUrls] = useState<(string | null)[]>([]);
  const [bulkShared, setBulkShared] = useState({
    userId: 0,
    genre: "",
    mood: "",
    isExplicit: false,
    coverUrl: "",
    releaseName: "",
    releaseDate: "",
    isFeatured: false,
  });
  const [bulkCoverDone, setBulkCoverDone] = useState(false);
  const [bulkDone, setBulkDone] = useState<{ id: number; title: string }[] | null>(null);

  const bulkCoverUpload = useUpload({
    onSuccess: (res) => {
      const url = `/api/storage${res.objectPath}`;
      setBulkShared(f => ({ ...f, coverUrl: url }));
      setBulkCoverDone(true);
    },
  });
  const [bulkCoverCropUrl, setBulkCoverCropUrl] = useState<string | null>(null);
  const handleBulkCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setBulkCoverCropUrl(URL.createObjectURL(f));
    e.target.value = "";
  };
  const handleBulkCoverCropConfirm = async (blob: Blob) => {
    if (bulkCoverCropUrl) URL.revokeObjectURL(bulkCoverCropUrl);
    setBulkCoverCropUrl(null);
    await bulkCoverUpload.uploadFile(new File([blob], "cover.jpg", { type: "image/jpeg" }));
  };

  const bulkUpload = useAdminBulkUploadSongs();

  const releaseType = getReleaseType(bulkFiles.length);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 20);
    setBulkFiles(files);
    setBulkTitles(files.map(f => f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")));
    setBulkUrls(new Array(files.length).fill(null));
    e.target.value = "";
  }

  const handleTitleChange = useCallback((idx: number, title: string) => {
    setBulkTitles(prev => prev.map((t, i) => i === idx ? title : t));
  }, []);

  const handleStreamUrlSet = useCallback((idx: number, url: string) => {
    setBulkUrls(prev => prev.map((u, i) => i === idx ? url : u));
  }, []);

  const handleRemoveBulkFile = useCallback((idx: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== idx));
    setBulkTitles(prev => prev.filter((_, i) => i !== idx));
    setBulkUrls(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const allUploaded = bulkUrls.length > 0 && bulkUrls.every(u => u !== null);

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkShared.userId || bulkFiles.length === 0) {
      toast({ title: "Missing fields", description: "Select an account and at least one song", variant: "destructive" });
      return;
    }
    if (!allUploaded) {
      toast({ title: "Upload audio files first", description: "All songs must be uploaded before publishing", variant: "destructive" });
      return;
    }
    if (releaseType !== "single" && !bulkShared.releaseName) {
      toast({ title: "Release name required", description: `An ${getReleaseLabel(releaseType)} needs a release name`, variant: "destructive" });
      return;
    }
    try {
      const songs = await bulkUpload.mutateAsync({
        data: {
          userId: bulkShared.userId,
          releaseName: bulkShared.releaseName || undefined,
          releaseType,
          genre: bulkShared.genre || undefined,
          mood: bulkShared.mood || undefined,
          isExplicit: bulkShared.isExplicit,
          coverUrl: bulkShared.coverUrl || undefined,
          releaseDate: bulkShared.releaseDate || undefined,
          isFeatured: bulkShared.isFeatured,
          songs: bulkTitles.map((title, i) => ({
            title,
            streamUrl: bulkUrls[i]!,
          })),
        },
      });
      setBulkDone(songs.map(s => ({ id: s.id, title: s.title })));
      toast({ title: `${songs.length} songs uploaded for review`, description: `${getReleaseLabel(releaseType)} is waiting in Admin › Submissions for your approval` });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message ?? "Unknown error", variant: "destructive" });
    }
  }

  const { data: accountsData } = useAdminGetUploadAccounts();
  const accounts = accountsData ?? [];
  // ── Success screens ────────────────────────────────────────────
  if (singleDone) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6 text-center pt-12">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <div>
          <h2 className="text-xl font-bold">Single Published!</h2>
          <p className="text-muted-foreground mt-1">"{singleDone.title}" is now live.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/songs/${singleDone.id}`}><Button variant="outline">View Song</Button></Link>
          <Button onClick={() => { setSingleDone(null); setForm({ title: "", userId: 0, genre: "", mood: "", isExplicit: false, duration: 0, streamUrl: "", coverUrl: "", releaseDate: "", isFeatured: false, lyrics: "", credits: "" }); }}>
            Upload Another
          </Button>
        </div>
      </div>
    );
  }

  if (bulkDone) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6 text-center pt-12">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <div>
          <h2 className="text-xl font-bold">{getReleaseLabel(releaseType)} Published!</h2>
          <p className="text-muted-foreground mt-1">{bulkDone.length} songs are now live on Everyday Radio.</p>
        </div>
        <div className="space-y-1 text-sm text-left w-full max-w-sm">
          {bulkDone.map(s => (
            <Link key={s.id} href={`/songs/${s.id}`}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary transition-colors">
                <Music className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </div>
            </Link>
          ))}
        </div>
        <Button onClick={() => { setBulkDone(null); setBulkFiles([]); setBulkTitles([]); setBulkUrls([]); setBulkShared({ userId: 0, genre: "", mood: "", isExplicit: false, coverUrl: "", releaseName: "", releaseDate: "", isFeatured: false }); setBulkCoverDone(false); }}>
          Upload More
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="rounded-full" title="Back to admin">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Music className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Upload Songs</h1>
            <p className="text-sm text-muted-foreground">Direct publish — no payment or review required</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bulk">
        <TabsList className="w-full">
          <TabsTrigger value="single" className="flex-1 gap-2"><Music className="w-3.5 h-3.5" />Single Song</TabsTrigger>
          <TabsTrigger value="bulk" className="flex-1 gap-2"><ListMusic className="w-3.5 h-3.5" />Bulk Upload</TabsTrigger>
        </TabsList>

        {/* ── Single Song Tab ─────────────────────────────────────── */}
        <TabsContent value="single" className="pt-4">
          <form onSubmit={handleSingleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Song Title *</Label>
              <Input id="title" placeholder="Enter song title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="song-account">Account *</Label>
              <select id="song-account" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: parseInt(e.target.value) }))} required>
                <option value={0}>Select account...</option>
                {accounts.map((a) => <option key={a.userId} value={a.userId}>{a.artistStageName ?? a.displayName ?? a.username} ({a.role})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="song-genre">Genre</Label>
                <select id="song-genre" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
                  <option value="">Select genre...</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="song-mood">Mood</Label>
                <select id="song-mood" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.mood} onChange={e => setForm(f => ({ ...f, mood: e.target.value }))}>
                  <option value="">Select mood...</option>
                  {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Audio File *</Label>
              {form.streamUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium truncate">Audio uploaded</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, streamUrl: "" }))}>Change</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to upload audio</p>
                    <p className="text-xs text-muted-foreground">MP3, WAV, FLAC</p>
                  </div>
                  {audioUpload.isUploading && <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${audioUpload.progress}%` }} /></div>}
                  <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) audioUpload.uploadFile(f); }} />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cover Art</Label>
              {form.coverUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <img src={form.coverUrl} alt="Cover" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium">Cover uploaded</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, coverUrl: "" }))}>Change</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to upload cover</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP (square recommended)</p>
                  </div>
                  {coverUpload.isUploading && <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${coverUpload.progress}%` }} /></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input id="duration" type="number" min={0} placeholder="e.g. 214" value={form.duration || ""} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input id="releaseDate" type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Goes live at 12:00 AM Eastern Time (ET) on this date.</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Featured</p>
                <p className="text-xs text-muted-foreground">Show on homepage featured section</p>
              </div>
              <Switch aria-label="Featured" checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Explicit Content</p>
                <p className="text-xs text-muted-foreground">Mark this song as containing explicit lyrics</p>
              </div>
              <Switch aria-label="Explicit content" checked={form.isExplicit} onCheckedChange={v => setForm(f => ({ ...f, isExplicit: v }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lyrics">Lyrics <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="lyrics"
                placeholder="Paste song lyrics here..."
                rows={4}
                value={form.lyrics}
                onChange={e => setForm(f => ({ ...f, lyrics: e.target.value }))}
                className="resize-none text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credits">Credits <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="credits"
                placeholder="e.g. Written by Jane Doe · Produced by John Smith · Mixed at Studio A"
                rows={3}
                value={form.credits}
                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                className="resize-none text-sm"
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={uploadSong.isPending || audioUpload.isUploading}>
              {uploadSong.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</> : <><Upload className="w-4 h-4" />Publish Single</>}
            </Button>
          </form>
        </TabsContent>

        {/* ── Bulk Upload Tab ──────────────────────────────────────── */}
        <TabsContent value="bulk" className="pt-4">
          <form onSubmit={handleBulkSubmit} className="space-y-5">

            {/* Shared metadata */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Release Metadata (shared across all songs)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-song-account">Artist *</Label>
                  <select id="bulk-song-account" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.userId} onChange={e => setBulkShared(f => ({ ...f, userId: parseInt(e.target.value) }))} required>
                    <option value={0}>Select account...</option>
                    {accounts.map((a) => <option key={a.userId} value={a.userId}>{a.artistStageName ?? a.displayName ?? a.username} ({a.role})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-song-genre">Genre</Label>
                    <select id="bulk-song-genre" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.genre} onChange={e => setBulkShared(f => ({ ...f, genre: e.target.value }))}>
                      <option value="">Select genre...</option>
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-song-mood">Mood</Label>
                    <select id="bulk-song-mood" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.mood} onChange={e => setBulkShared(f => ({ ...f, mood: e.target.value }))}>
                      <option value="">Select mood...</option>
                      {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-release-name">Release / Album Name {releaseType !== "single" && <span className="text-red-400">*</span>}</Label>
                  <Input
                    id="bulk-release-name"
                    placeholder={releaseType === "single" ? "Optional for singles" : `Required for ${getReleaseLabel(releaseType)}s`}
                    value={bulkShared.releaseName}
                    onChange={e => setBulkShared(f => ({ ...f, releaseName: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-release-date">Release Date</Label>
                    <Input id="bulk-release-date" type="date" value={bulkShared.releaseDate} onChange={e => setBulkShared(f => ({ ...f, releaseDate: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Goes live at 12:00 AM Eastern Time (ET) on this date.</p>
                  </div>
                  <div className="space-y-1 pt-6">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <p className="text-sm font-medium">Featured</p>
                      <Switch aria-label="Featured" checked={bulkShared.isFeatured} onCheckedChange={v => setBulkShared(f => ({ ...f, isFeatured: v }))} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">Explicit Content</p>
                    <p className="text-xs text-muted-foreground">Mark all songs in this release as explicit</p>
                  </div>
                  <Switch aria-label="Explicit content" checked={bulkShared.isExplicit} onCheckedChange={v => setBulkShared(f => ({ ...f, isExplicit: v }))} />
                </div>

                {/* Shared cover art */}
                <div className="space-y-2">
                  <Label>Cover Art (shared)</Label>
                  {bulkCoverDone ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                      <img src={bulkShared.coverUrl} alt="Cover" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      <span className="text-sm text-green-400 font-medium">Cover uploaded</span>
                      <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { setBulkShared(f => ({ ...f, coverUrl: "" })); setBulkCoverDone(false); }}>Change</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Click to upload cover art</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG, WebP (square recommended)</p>
                      </div>
                      {bulkCoverUpload.isUploading && <div className="ml-auto w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${bulkCoverUpload.progress}%` }} /></div>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleBulkCoverFile} />
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Audio Files *</Label>
                {bulkFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    {getReleaseIcon(releaseType)}
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold uppercase tracking-wider ${
                        releaseType === "single" ? "border-blue-500/40 text-blue-400" :
                        releaseType === "ep" ? "border-purple-500/40 text-purple-400" :
                        "border-primary/40 text-primary"
                      }`}
                    >
                      {bulkFiles.length} track{bulkFiles.length !== 1 ? "s" : ""} → {getReleaseLabel(releaseType)}
                    </Badge>
                  </div>
                )}
              </div>

              {bulkFiles.length === 0 ? (
                <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ListMusic className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to select audio files</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      1 = Single &nbsp;·&nbsp; 2–6 = EP &nbsp;·&nbsp; 7+ = Album
                    </p>
                    <p className="text-xs text-muted-foreground">MP3, WAV, FLAC • Up to 20 files</p>
                  </div>
                  <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFilesSelected} />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                    {bulkFiles.map((file, i) => (
                      <SongUploadRow
                        key={`${file.name}-${i}`}
                        file={file}
                        title={bulkTitles[i] ?? ""}
                        index={i}
                        onTitleChange={handleTitleChange}
                        onStreamUrlSet={handleStreamUrlSet}
                        onRemove={handleRemoveBulkFile}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => { setBulkFiles([]); setBulkTitles([]); setBulkUrls([]); }}
                    >
                      <X className="w-3 h-3" />
                      Clear all
                    </Button>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                        <Upload className="w-3 h-3" />
                        Replace files
                      </Button>
                      <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFilesSelected} />
                    </label>
                    <div className="ml-auto text-xs text-muted-foreground">
                      {bulkUrls.filter(u => u !== null).length} / {bulkFiles.length} uploaded
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={bulkUpload.isPending || bulkFiles.length === 0 || !allUploaded}
            >
              {bulkUpload.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Publishing {bulkFiles.length} songs...</>
              ) : (
                <><Upload className="w-4 h-4" />Publish {bulkFiles.length > 0 ? `${getReleaseLabel(releaseType)} (${bulkFiles.length} songs)` : "Songs"}</>
              )}
            </Button>
            {bulkFiles.length > 0 && !allUploaded && (
              <p className="text-xs text-muted-foreground text-center">Upload all audio files above before publishing</p>
            )}
          </form>
        </TabsContent>
      </Tabs>
      <ExperienceFeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} trigger="after_upload" />
      {coverCropUrl && (
        <ImageCropModal
          imageUrl={coverCropUrl}
          aspectRatio={1}
          title="Crop Cover Art"
          outputSize={800}
          onConfirm={handleCoverCropConfirm}
          onCancel={() => { URL.revokeObjectURL(coverCropUrl); setCoverCropUrl(null); }}
        />
      )}
      {bulkCoverCropUrl && (
        <ImageCropModal
          imageUrl={bulkCoverCropUrl}
          aspectRatio={1}
          title="Crop Cover Art"
          outputSize={800}
          onConfirm={handleBulkCoverCropConfirm}
          onCancel={() => { URL.revokeObjectURL(bulkCoverCropUrl); setBulkCoverCropUrl(null); }}
        />
      )}
    </div>
  );
}
