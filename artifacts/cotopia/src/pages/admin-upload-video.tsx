import { useState, useCallback } from "react";
import { useAdminUploadVideo, useAdminBulkUploadVideos, useAdminGetUploadAccounts } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Upload, Video, ArrowLeft, CheckCircle, ListVideo, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const GENRES = ["Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Country", "Reggae", "Latin", "Afrobeats", "Indie", "Alternative", "Metal", "Folk", "Soul", "Blues", "Other"];
const MOODS = ["Energetic", "Chill", "Romantic", "Dark", "Happy", "Melancholic", "Motivational", "Party", "Peaceful", "Nostalgic", "Intense", "Dreamy"];

// Per-row upload component — each row has its own hook instance
function VideoUploadRow({
  file,
  title,
  index,
  onTitleChange,
  onVideoUrlSet,
}: {
  file: File;
  title: string;
  index: number;
  onTitleChange: (idx: number, t: string) => void;
  onVideoUrlSet: (idx: number, url: string) => void;
}) {
  const [done, setDone] = useState(false);
  const upload = useUpload({
    onSuccess: (res) => {
      setDone(true);
      onVideoUrlSet(index, `/api/storage${res.objectPath}`);
    },
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <span className="text-xs text-muted-foreground w-5 text-center font-bold flex-shrink-0">{index + 1}</span>
      <Input
        value={title}
        onChange={e => onTitleChange(index, e.target.value)}
        className="flex-1 h-8 text-sm"
        placeholder="Video title"
      />
      <span className="text-xs text-muted-foreground truncate max-w-[130px] flex-shrink-0" title={file.name}>{file.name}</span>
      {done ? (
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : upload.isUploading ? (
        <div className="flex items-center gap-2 flex-shrink-0 w-24">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${upload.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{upload.progress}%</span>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-shrink-0" onClick={() => upload.uploadFile(file)}>
          <Upload className="w-3 h-3 mr-1" />Upload
        </Button>
      )}
    </div>
  );
}

export default function AdminUploadVideo() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin" && user.role !== "editor") navigate("/");
  }, [user, navigate]);

  const { data: accountsData } = useAdminGetUploadAccounts();
  const accounts = accountsData ?? [];

  // ── Single video state ────────────────────────────────────────
  const [form, setForm] = useState({ title: "", userId: 0, genre: "", mood: "", isExplicit: false, description: "", credits: "", duration: 0, videoUrl: "", thumbnailUrl: "", releaseDate: "", isFeatured: false });
  const [singleDone, setSingleDone] = useState<{ id: number; title: string } | null>(null);

  const videoUpload = useUpload({ onSuccess: (res) => setForm(f => ({ ...f, videoUrl: `/api/storage${res.objectPath}` })) });
  const thumbUpload = useUpload({ onSuccess: (res) => setForm(f => ({ ...f, thumbnailUrl: `/api/storage${res.objectPath}` })) });
  const uploadVideo = useAdminUploadVideo();

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.userId || !form.videoUrl) {
      toast({ title: "Missing required fields", description: "Title, artist, and video file are required", variant: "destructive" });
      return;
    }
    try {
      const video = await uploadVideo.mutateAsync({
        data: { title: form.title, userId: form.userId, genre: form.genre || undefined, mood: form.mood || undefined, isExplicit: form.isExplicit, description: form.description || undefined, credits: form.credits || undefined, duration: form.duration || undefined, videoUrl: form.videoUrl, thumbnailUrl: form.thumbnailUrl || undefined, releaseDate: form.releaseDate || undefined, isFeatured: form.isFeatured },
      });
      setSingleDone({ id: video.id, title: video.title });
      toast({ title: "Video uploaded for review", description: `"${video.title}" is waiting in Admin › Submissions for your approval` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Unknown error", variant: "destructive" });
    }
  }

  // ── Bulk video state ──────────────────────────────────────────
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkTitles, setBulkTitles] = useState<string[]>([]);
  const [bulkUrls, setBulkUrls] = useState<(string | null)[]>([]);
  const [bulkShared, setBulkShared] = useState({ userId: 0, genre: "", mood: "", isExplicit: false, description: "", thumbnailUrl: "", releaseDate: "", isFeatured: false });
  const [bulkThumbDone, setBulkThumbDone] = useState(false);
  const [bulkDone, setBulkDone] = useState<{ id: number; title: string }[] | null>(null);

  const bulkThumbUpload = useUpload({ onSuccess: (res) => { setBulkShared(f => ({ ...f, thumbnailUrl: `/api/storage${res.objectPath}` })); setBulkThumbDone(true); } });
  const bulkUpload = useAdminBulkUploadVideos();

  const allUploaded = bulkUrls.length > 0 && bulkUrls.every(u => u !== null);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setBulkFiles(files);
    setBulkTitles(files.map(f => f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")));
    setBulkUrls(new Array(files.length).fill(null));
    e.target.value = "";
  }

  const handleTitleChange = useCallback((idx: number, title: string) => {
    setBulkTitles(prev => prev.map((t, i) => i === idx ? title : t));
  }, []);

  const handleVideoUrlSet = useCallback((idx: number, url: string) => {
    setBulkUrls(prev => prev.map((u, i) => i === idx ? url : u));
  }, []);

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkShared.userId || bulkFiles.length === 0) {
      toast({ title: "Missing fields", description: "Select an account and at least one video", variant: "destructive" });
      return;
    }
    if (!allUploaded) {
      toast({ title: "Upload video files first", description: "All videos must be uploaded before publishing", variant: "destructive" });
      return;
    }
    try {
      const videos = await bulkUpload.mutateAsync({
        data: {
          userId: bulkShared.userId,
          genre: bulkShared.genre || undefined,
          mood: bulkShared.mood || undefined,
          isExplicit: bulkShared.isExplicit,
          description: bulkShared.description || undefined,
          thumbnailUrl: bulkShared.thumbnailUrl || undefined,
          releaseDate: bulkShared.releaseDate || undefined,
          isFeatured: bulkShared.isFeatured,
          videos: bulkTitles.map((title, i) => ({ title, videoUrl: bulkUrls[i]! })),
        },
      });
      setBulkDone(videos.map(v => ({ id: v.id, title: v.title })));
      toast({ title: `${videos.length} videos uploaded for review`, description: "All videos are waiting in Admin › Submissions for your approval" });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message ?? "Unknown error", variant: "destructive" });
    }
  }

  // ── Success screens ───────────────────────────────────────────
  if (singleDone) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6 text-center pt-12">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <div><h2 className="text-xl font-bold">Video Published!</h2><p className="text-muted-foreground mt-1">"{singleDone.title}" is now live.</p></div>
        <div className="flex gap-3">
          <Link href={`/videos/${singleDone.id}`}><Button variant="outline">View Video</Button></Link>
          <Button onClick={() => { setSingleDone(null); setForm({ title: "", userId: 0, genre: "", mood: "", isExplicit: false, description: "", credits: "", duration: 0, videoUrl: "", thumbnailUrl: "", releaseDate: "", isFeatured: false }); }}>Upload Another</Button>
        </div>
      </div>
    );
  }

  if (bulkDone) {
    return (
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6 text-center pt-12">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <div><h2 className="text-xl font-bold">{bulkDone.length} Videos Published!</h2><p className="text-muted-foreground mt-1">All videos are now live on Everyday Radio.</p></div>
        <div className="space-y-1 text-sm text-left w-full max-w-sm">
          {bulkDone.map(v => (
            <Link key={v.id} href={`/videos/${v.id}`}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary transition-colors">
                <Video className="w-3.5 h-3.5 text-primary flex-shrink-0" /><span className="truncate">{v.title}</span>
              </div>
            </Link>
          ))}
        </div>
        <Button onClick={() => { setBulkDone(null); setBulkFiles([]); setBulkTitles([]); setBulkUrls([]); setBulkShared({ userId: 0, genre: "", mood: "", isExplicit: false, description: "", thumbnailUrl: "", releaseDate: "", isFeatured: false }); setBulkThumbDone(false); }}>
          Upload More
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin"><Button variant="ghost" size="icon" className="rounded-full" title="Back to admin"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Upload Videos</h1>
            <p className="text-sm text-muted-foreground">Direct publish — no payment or review required</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bulk">
        <TabsList className="w-full">
          <TabsTrigger value="single" className="flex-1 gap-2"><Video className="w-3.5 h-3.5" />Single Video</TabsTrigger>
          <TabsTrigger value="bulk" className="flex-1 gap-2"><ListVideo className="w-3.5 h-3.5" />Bulk Upload</TabsTrigger>
        </TabsList>

        {/* ── Single Video Tab ──────────────────────────────────── */}
        <TabsContent value="single" className="pt-4">
          <form onSubmit={handleSingleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Video Title *</Label>
              <Input id="title" placeholder="Enter video title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            <div className="space-y-2">
              <Label>Account *</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: parseInt(e.target.value) }))} required>
                <option value={0}>Select account...</option>
                {accounts.map((a) => <option key={a.userId} value={a.userId}>{a.artistStageName ?? a.displayName ?? a.username} ({a.role})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Genre</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
                  <option value="">Select genre...</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Mood</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.mood} onChange={e => setForm(f => ({ ...f, mood: e.target.value }))}>
                  <option value="">Select mood...</option>
                  {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Describe this video..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credits">Credits <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="credits"
                placeholder="e.g. Directed by Jane Doe · Cinematography by John Smith · Music by Nova Sounds"
                rows={3}
                value={form.credits}
                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Video File *</Label>
              {form.videoUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium">Video uploaded</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, videoUrl: "" }))}>Change</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center"><p className="text-sm font-medium">Click to upload video</p><p className="text-xs text-muted-foreground">MP4, MOV, WebM</p></div>
                  {videoUpload.isUploading && <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${videoUpload.progress}%` }} /></div>}
                  <input type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) videoUpload.uploadFile(f); }} />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label>Thumbnail</Label>
              {form.thumbnailUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <img src={form.thumbnailUrl} alt="Thumb" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <span className="text-sm text-green-400 font-medium">Thumbnail uploaded</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, thumbnailUrl: "" }))}>Change</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center"><p className="text-sm font-medium">Click to upload thumbnail</p><p className="text-xs text-muted-foreground">JPG, PNG, WebP (16:9 recommended)</p></div>
                  {thumbUpload.isUploading && <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${thumbUpload.progress}%` }} /></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) thumbUpload.uploadFile(f); }} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input id="duration" type="number" min={0} placeholder="e.g. 234" value={form.duration || ""} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input id="releaseDate" type="date" value={form.releaseDate} onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div><p className="text-sm font-medium">Featured</p><p className="text-xs text-muted-foreground">Show on homepage featured section</p></div>
              <Switch checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div><p className="text-sm font-medium">Explicit Content</p><p className="text-xs text-muted-foreground">Mark this video as containing explicit content</p></div>
              <Switch checked={form.isExplicit} onCheckedChange={v => setForm(f => ({ ...f, isExplicit: v }))} />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={uploadVideo.isPending || videoUpload.isUploading}>
              {uploadVideo.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</> : <><Upload className="w-4 h-4" />Publish Video</>}
            </Button>
          </form>
        </TabsContent>

        {/* ── Bulk Upload Tab ───────────────────────────────────── */}
        <TabsContent value="bulk" className="pt-4">
          <form onSubmit={handleBulkSubmit} className="space-y-5">
            {/* Shared metadata */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Shared Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Artist *</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.userId} onChange={e => setBulkShared(f => ({ ...f, userId: parseInt(e.target.value) }))} required>
                    <option value={0}>Select account...</option>
                    {accounts.map((a) => <option key={a.userId} value={a.userId}>{a.artistStageName ?? a.displayName ?? a.username} ({a.role})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.genre} onChange={e => setBulkShared(f => ({ ...f, genre: e.target.value }))}>
                      <option value="">Select genre...</option>
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mood</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={bulkShared.mood} onChange={e => setBulkShared(f => ({ ...f, mood: e.target.value }))}>
                      <option value="">Select mood...</option>
                      {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-desc">Description (shared)</Label>
                  <Textarea id="bulk-desc" placeholder="Describe these videos..." rows={2} value={bulkShared.description} onChange={e => setBulkShared(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Release Date</Label>
                    <Input type="date" value={bulkShared.releaseDate} onChange={e => setBulkShared(f => ({ ...f, releaseDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1 pt-6">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <p className="text-sm font-medium">Featured</p>
                      <Switch checked={bulkShared.isFeatured} onCheckedChange={v => setBulkShared(f => ({ ...f, isFeatured: v }))} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">Explicit Content</p>
                    <p className="text-xs text-muted-foreground">Mark all videos in this batch as explicit</p>
                  </div>
                  <Switch checked={bulkShared.isExplicit} onCheckedChange={v => setBulkShared(f => ({ ...f, isExplicit: v }))} />
                </div>

                {/* Shared thumbnail */}
                <div className="space-y-2">
                  <Label>Thumbnail (shared, optional)</Label>
                  {bulkThumbDone ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                      <img src={bulkShared.thumbnailUrl} alt="Thumb" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      <span className="text-sm text-green-400 font-medium">Thumbnail uploaded</span>
                      <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { setBulkShared(f => ({ ...f, thumbnailUrl: "" })); setBulkThumbDone(false); }}>Change</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div><p className="text-sm font-medium">Click to upload shared thumbnail</p><p className="text-xs text-muted-foreground">JPG, PNG, WebP (16:9 recommended)</p></div>
                      {bulkThumbUpload.isUploading && <div className="ml-auto w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all rounded-full" style={{ width: `${bulkThumbUpload.progress}%` }} /></div>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) bulkThumbUpload.uploadFile(f); }} />
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Video Files *</Label>
                {bulkFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">{bulkUrls.filter(u => u !== null).length} / {bulkFiles.length} uploaded</span>
                )}
              </div>

              {bulkFiles.length === 0 ? (
                <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ListVideo className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to select video files</p>
                    <p className="text-xs text-muted-foreground mt-0.5">MP4, MOV, WebM · Select as many as you need</p>
                  </div>
                  <input type="file" accept="video/*" multiple className="hidden" onChange={handleFilesSelected} />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {bulkFiles.map((file, i) => (
                      <VideoUploadRow
                        key={`${file.name}-${i}`}
                        file={file}
                        title={bulkTitles[i] ?? ""}
                        index={i}
                        onTitleChange={handleTitleChange}
                        onVideoUrlSet={handleVideoUrlSet}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => { setBulkFiles([]); setBulkTitles([]); setBulkUrls([]); }}>
                      <X className="w-3 h-3" />Clear all
                    </Button>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                        <Upload className="w-3 h-3" />Replace files
                      </Button>
                      <input type="file" accept="video/*" multiple className="hidden" onChange={handleFilesSelected} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={bulkUpload.isPending || bulkFiles.length === 0 || !allUploaded}>
              {bulkUpload.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Publishing {bulkFiles.length} videos...</>
                : <><Upload className="w-4 h-4" />Publish {bulkFiles.length > 0 ? `${bulkFiles.length} Video${bulkFiles.length !== 1 ? "s" : ""}` : "Videos"}</>}
            </Button>
            {bulkFiles.length > 0 && !allUploaded && (
              <p className="text-xs text-muted-foreground text-center">Upload all video files above before publishing</p>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
