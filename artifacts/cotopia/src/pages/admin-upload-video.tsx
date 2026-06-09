import { useState } from "react";
import { useAdminUploadVideo, useListArtists } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Upload, Video, ArrowLeft, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const GENRES = ["Electronic", "Synthwave", "Indie Pop", "Hip Hop", "R&B", "Jazz", "Classical", "Rock", "Pop", "Ambient", "Lo-fi", "Other"];

export default function AdminUploadVideo() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin" && user.role !== "editor") navigate("/");
  }, [user, navigate]);

  const [form, setForm] = useState({
    title: "",
    artistId: 0,
    genre: "",
    description: "",
    duration: 0,
    videoUrl: "",
    thumbnailUrl: "",
    releaseDate: "",
    isFeatured: false,
  });
  const [done, setDone] = useState<{ id: number; title: string } | null>(null);

  const { data: artistsData } = useListArtists({});
  const artists = artistsData ?? [];

  const videoUpload = useUpload({
    onSuccess: (res) => setForm(f => ({ ...f, videoUrl: `/api/storage${res.objectPath}` })),
  });
  const thumbUpload = useUpload({
    onSuccess: (res) => setForm(f => ({ ...f, thumbnailUrl: `/api/storage${res.objectPath}` })),
  });

  const uploadVideo = useAdminUploadVideo();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.artistId || !form.videoUrl) {
      toast({ title: "Missing required fields", description: "Title, artist, and video file are required", variant: "destructive" });
      return;
    }
    try {
      const video = await uploadVideo.mutateAsync({
        data: {
          title: form.title,
          artistId: form.artistId,
          genre: form.genre || undefined,
          description: form.description || undefined,
          duration: form.duration || undefined,
          videoUrl: form.videoUrl,
          thumbnailUrl: form.thumbnailUrl || undefined,
          releaseDate: form.releaseDate || undefined,
          isFeatured: form.isFeatured,
        },
      });
      setDone({ id: video.id, title: video.title });
      toast({ title: "Video published!", description: `"${video.title}" is now live on Everyday Radio` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Unknown error", variant: "destructive" });
    }
  }

  if (done) {
    return (
      <div className="p-8 max-w-xl mx-auto flex flex-col items-center gap-6 text-center">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <div>
          <h2 className="text-xl font-bold">Video Published!</h2>
          <p className="text-muted-foreground mt-1">"{done.title}" is now live on Everyday Radio.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/videos/${done.id}`}>
            <Button variant="outline">View Video</Button>
          </Link>
          <Button onClick={() => { setDone(null); setForm({ title: "", artistId: 0, genre: "", description: "", duration: 0, videoUrl: "", thumbnailUrl: "", releaseDate: "", isFeatured: false }); }}>
            Upload Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Upload Video</h1>
            <p className="text-sm text-muted-foreground">Direct admin publish — no payment required</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Video Title *</Label>
          <Input id="title" placeholder="Enter video title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        </div>

        {/* Artist */}
        <div className="space-y-2">
          <Label htmlFor="artist">Artist *</Label>
          <select
            id="artist"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.artistId}
            onChange={e => setForm(f => ({ ...f, artistId: parseInt(e.target.value) }))}
            required
          >
            <option value={0}>Select artist...</option>
            {artists.map((a: any) => (
              <option key={a.id} value={a.id}>{a.stageName}</option>
            ))}
          </select>
        </div>

        {/* Genre */}
        <div className="space-y-2">
          <Label htmlFor="genre">Genre</Label>
          <select
            id="genre"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.genre}
            onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
          >
            <option value="">Select genre...</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" placeholder="Describe this video..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        {/* Video Upload */}
        <div className="space-y-2">
          <Label>Video File *</Label>
          {form.videoUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400 font-medium truncate">Video uploaded</span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, videoUrl: "" }))}>Change</Button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload video</p>
                <p className="text-xs text-muted-foreground">MP4, MOV, WebM</p>
              </div>
              {videoUpload.isUploading && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${videoUpload.progress}%` }} />
                </div>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) videoUpload.uploadFile(file);
              }} />
            </label>
          )}
        </div>

        {/* Thumbnail */}
        <div className="space-y-2">
          <Label>Thumbnail</Label>
          {form.thumbnailUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
              <img src={form.thumbnailUrl} alt="Thumbnail" className="w-10 h-10 rounded object-cover flex-shrink-0" />
              <span className="text-sm text-green-400 font-medium">Thumbnail uploaded</span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setForm(f => ({ ...f, thumbnailUrl: "" }))}>Change</Button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload thumbnail</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP (16:9 recommended)</p>
              </div>
              {thumbUpload.isUploading && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${thumbUpload.progress}%` }} />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) thumbUpload.uploadFile(file);
              }} />
            </label>
          )}
        </div>

        {/* Duration + Release Date */}
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

        {/* Featured toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium">Featured</p>
            <p className="text-xs text-muted-foreground">Show on homepage featured section</p>
          </div>
          <Switch checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={uploadVideo.isPending || videoUpload.isUploading}>
          {uploadVideo.isPending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Publishing...</>
          ) : (
            <><Upload className="w-4 h-4" />Publish Video</>
          )}
        </Button>
      </form>
    </div>
  );
}
