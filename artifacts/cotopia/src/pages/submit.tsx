import { useState, useCallback, useRef, useEffect } from "react";
import { useCreateBulkSubmission, useInitiatePayment, useCapturePayment } from "@workspace/api-client-react";
import { useUpload } from "../lib/useUpload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Music, Film, CheckCircle, CreditCard, FileText,
  ChevronRight, ChevronLeft, Radio, Star, Zap, Upload,
  Calendar, AlertCircle, Loader2, ImageIcon, ListMusic, ListVideo, X,
} from "lucide-react";

const GENRES = ["Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Country", "Reggae", "Latin", "Afrobeats", "Indie", "Alternative", "Metal", "Folk", "Soul", "Blues", "Other"];
const MOODS = ["Energetic", "Chill", "Romantic", "Dark", "Happy", "Melancholic", "Motivational", "Party", "Peaceful", "Nostalgic", "Intense", "Dreamy"];

const MAX_FILES_PER_TYPE = 20;
const MAX_FILES_TOTAL = 20;

const PLAN_PRICES = {
  song:  { single: 9.99,  basic: 19.99, premium: 49.99 },
  video: { single: 14.99, basic: 29.99, premium: 79.99 },
};

const PLAN_NAMES: Record<string, string> = {
  single:  "Single Submission",
  basic:   "Batch Submission",
  premium: "Featured Placement",
};

function getPlanFeatures(_tab: "song" | "video"): Record<string, string[]> {
  return {
    single: [
      "One content submission",
      "Professional review",
      "Artist profile listing",
      "Eligible for publishing if approved",
    ],
    basic: [
      "Batch review",
      "Faster processing",
      "Artist profile listing",
      "Eligible for publishing if approved",
    ],
    premium: [
      "Priority review",
      "Featured placement consideration",
      "Homepage eligibility",
      "Playlist consideration",
      "Social media consideration when appropriate",
    ],
  };
}

const STEPS = ["Files & Details", "Plan", "Payment", "Complete"];

const MUSIC_RELEASE_TYPES = ["Single", "EP", "Album"] as const;
const VIDEO_RELEASE_TYPES = ["Video", "Video Collection"] as const;

function detectReleaseType(count: number, type: "song" | "video"): string {
  if (type === "video") return count <= 1 ? "Video" : "Video Collection";
  if (count <= 1) return "Single";
  if (count <= 6) return "EP";
  return "Album";
}

function releaseTypeBadgeClass(rt: string): string {
  if (rt === "EP") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (rt === "Album") return "bg-violet-500/20 text-violet-400 border-violet-500/30";
  if (rt === "Video Collection") return "bg-teal-500/20 text-teal-400 border-teal-500/30";
  return "bg-muted text-muted-foreground border-border";
}

// ── Per-row file upload component ─────────────────────────────────────────────
function FileRow({
  file,
  title,
  index,
  accept,
  onTitleChange,
  onUrlSet,
  onRemove,
}: {
  file: File;
  title: string;
  index: number;
  accept: string;
  onTitleChange: (i: number, t: string) => void;
  onUrlSet: (i: number, url: string) => void;
  onRemove: (i: number) => void;
}) {
  const [done, setDone] = useState(false);
  const didUpload = useRef(false);
  const upload = useUpload({
    onSuccess: (res) => { setDone(true); onUrlSet(index, `/api/storage${res.objectPath}`); },
  });

  useEffect(() => {
    if (!didUpload.current) {
      didUpload.current = true;
      upload.uploadFile(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
      <span className="text-xs text-muted-foreground w-5 text-center font-bold flex-shrink-0">{index + 1}</span>
      <Input
        value={title}
        onChange={e => onTitleChange(index, e.target.value)}
        className="flex-1 h-8 text-sm bg-background/50"
        placeholder="Track title"
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
      <button type="button" onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Shared metadata form ───────────────────────────────────────────────────────
interface SharedMeta {
  artistName: string; // read-only display — populated from logged-in user, not editable
  labelName: string;
  genre: string;
  mood: string;
  description: string;
  lyrics: string;
  credits: string;
  releaseDate: string;
  isExplicit: boolean;
  coverUrl: string;
}

function MetadataSection({ meta, onChange, type }: { meta: SharedMeta; onChange: (m: SharedMeta) => void; type: "song" | "video" }) {
  const set = (patch: Partial<SharedMeta>) => onChange({ ...meta, ...patch });
  const coverUpload = useUpload({ onSuccess: (res) => set({ coverUrl: `/api/storage${res.objectPath}` }) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Artist / Stage Name</Label>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-secondary bg-secondary/30 text-sm text-muted-foreground select-none">
            {meta.artistName || "—"}
          </div>
          <p className="text-[11px] text-muted-foreground/60">Your registered artist name — set from your account</p>
        </div>
        <div className="space-y-2">
          <Label>Label Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input placeholder="e.g. Neon Records" value={meta.labelName} onChange={e => set({ labelName: e.target.value })} className="bg-secondary/50 border-secondary" />
        </div>
        <div className="space-y-2">
          <Label>Genre</Label>
          <Select value={meta.genre} onValueChange={v => set({ genre: v })}>
            <SelectTrigger className="bg-secondary/50 border-secondary"><SelectValue placeholder="Select genre" /></SelectTrigger>
            <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mood</Label>
          <Select value={meta.mood} onValueChange={v => set({ mood: v })}>
            <SelectTrigger className="bg-secondary/50 border-secondary"><SelectValue placeholder="Select mood" /></SelectTrigger>
            <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description <span className="text-muted-foreground text-xs">(optional, shared across all tracks)</span></Label>
        <Textarea placeholder="Tell us about this release — the story, the inspiration, the vibe..." rows={2} value={meta.description} onChange={e => set({ description: e.target.value })} className="bg-secondary/50 border-secondary resize-none" />
      </div>

      {type === "song" && (
        <div className="space-y-2">
          <Label>Lyrics <span className="text-muted-foreground text-xs">(optional, shared across all tracks)</span></Label>
          <Textarea placeholder="Paste your song lyrics here..." rows={4} value={meta.lyrics} onChange={e => set({ lyrics: e.target.value })} className="bg-secondary/50 border-secondary resize-none font-mono text-sm" />
        </div>
      )}

      <div className="space-y-2">
        <Label>Credits <span className="text-muted-foreground text-xs">(optional, shared across all tracks)</span></Label>
        <Textarea placeholder="e.g. Written by Jane Doe · Produced by John Smith · Mastered at Studio A" rows={2} value={meta.credits} onChange={e => set({ credits: e.target.value })} className="bg-secondary/50 border-secondary resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Release Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="date" value={meta.releaseDate} onChange={e => set({ releaseDate: e.target.value })} className="bg-secondary/50 border-secondary" />
        </div>
        <div className="flex items-end pb-0.5">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20 w-full">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                Explicit Content
                {meta.isExplicit && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">E</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">Mature language or themes</p>
            </div>
            <Switch checked={meta.isExplicit} onCheckedChange={v => set({ isExplicit: v })} className="ml-auto" />
          </div>
        </div>
      </div>

      {/* Cover / Thumbnail */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5" />{type === "song" ? "Cover Art" : "Thumbnail"} <span className="text-muted-foreground text-xs">(optional, shared)</span></Label>
        {meta.coverUrl ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
            <img src={meta.coverUrl} alt="Cover" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            <span className="text-sm text-green-400 font-medium">Uploaded ✓</span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => set({ coverUrl: "" })}>Change</Button>
          </div>
        ) : (
          <label className="flex items-center gap-3 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Click to upload {type === "song" ? "cover art" : "thumbnail"}</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
            </div>
            {coverUpload.isUploading && (
              <div className="ml-auto w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${coverUpload.progress}%` }} />
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) coverUpload.uploadFile(f); }} />
          </label>
        )}
      </div>
    </div>
  );
}

// ── File list section ─────────────────────────────────────────────────────────
function FileList({
  files,
  titles,
  urls,
  accept,
  icon: Icon,
  label,
  hint,
  remaining,
  maxFiles,
  releaseType,
  onFilesSelected,
  onTitleChange,
  onUrlSet,
  onRemove,
}: {
  files: File[];
  titles: string[];
  urls: (string | null)[];
  accept: string;
  icon: React.ElementType;
  label: string;
  hint: string;
  remaining: number;
  maxFiles: number;
  releaseType?: string;
  onFilesSelected: (files: File[]) => void;
  onTitleChange: (i: number, t: string) => void;
  onUrlSet: (i: number, url: string) => void;
  onRemove: (i: number) => void;
}) {
  const addMoreRef = useRef<HTMLInputElement>(null);
  const uploaded = urls.filter(u => u !== null).length;
  const atLimit = remaining <= 0 || files.length >= maxFiles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" />{label} <span className="text-destructive">*</span>
          {files.length > 0 && releaseType && (
            <Badge className={`text-[10px] px-1.5 py-0 ${releaseTypeBadgeClass(releaseType)}`}>
              {releaseType}
            </Badge>
          )}
        </Label>
        <div className="flex items-center gap-2">
          {files.length > 0 && <span className="text-xs text-muted-foreground">{uploaded}/{files.length} uploaded</span>}
          <span className="text-xs text-muted-foreground">{remaining} slot{remaining !== 1 ? "s" : ""} left</span>
        </div>
      </div>

      {files.length === 0 ? (
        <label className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-lg transition-colors ${atLimit ? "border-border/30 opacity-50 cursor-not-allowed" : "border-border cursor-pointer hover:border-primary/50"}`}>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{atLimit ? "Limit reached" : "Click to select files"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{hint} · Max {maxFiles} file{maxFiles !== 1 ? "s" : ""}</p>
          </div>
          {!atLimit && <input type="file" accept={accept} multiple={maxFiles > 1} className="hidden"
            onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) { onFilesSelected(fs); e.target.value = ""; } }} />}
        </label>
      ) : (
        <div className="space-y-2">
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((file, i) => (
              <FileRow
                key={`${file.name}-${i}`}
                file={file}
                title={titles[i] ?? ""}
                index={i}
                accept={accept}
                onTitleChange={onTitleChange}
                onUrlSet={onUrlSet}
                onRemove={onRemove}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {!atLimit && (
              <>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => addMoreRef.current?.click()}>
                  <Upload className="w-3 h-3" />Add more files
                </Button>
                <input ref={addMoreRef} type="file" accept={accept} multiple={maxFiles > 1} className="hidden"
                  onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) { onFilesSelected(fs); e.target.value = ""; } }} />
              </>
            )}
            {atLimit && <span className="text-xs text-amber-400 font-medium">Maximum {maxFiles} file{maxFiles !== 1 ? "s" : ""} reached</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const defaultMeta: SharedMeta = { artistName: "", labelName: "", genre: "", mood: "", description: "", lyrics: "", credits: "", releaseDate: "", isExplicit: false, coverUrl: "" };

export default function Submit() {
  const { user } = useAuth();
  const lockedArtistName = (user as any)?.displayName || user?.username || "";
  const { toast } = useToast();

  useEffect(() => {
    if (lockedArtistName) {
      setSongMeta(m => ({ ...m, artistName: lockedArtistName }));
      setVideoMeta(m => ({ ...m, artistName: lockedArtistName }));
    }
  }, [lockedArtistName]);
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"song" | "video">("song");
  const [plan, setPlan] = useState<"single" | "basic" | "premium">("single");

  // Bulk state — separate for songs and videos
  const [songFiles, setSongFiles] = useState<File[]>([]);
  const [songTitles, setSongTitles] = useState<string[]>([]);
  const [songUrls, setSongUrls] = useState<(string | null)[]>([]);
  const [songMeta, setSongMeta] = useState<SharedMeta>({ ...defaultMeta });

  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoTitles, setVideoTitles] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<(string | null)[]>([]);
  const [videoMeta, setVideoMeta] = useState<SharedMeta>({ ...defaultMeta });

  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [submissionIds, setSubmissionIds] = useState<number[]>([]);
  const [successTitles, setSuccessTitles] = useState<string[]>([]);
  const LEGAL_TOTAL = 6;
  const [legalChecks, setLegalChecks] = useState<boolean[]>(Array(LEGAL_TOTAL).fill(false));
  const allLegalChecked = legalChecks.every(Boolean);

  const [songReleaseType, setSongReleaseType] = useState<string>("");
  const [videoReleaseType, setVideoReleaseType] = useState<string>("");
  const [songReleaseName, setSongReleaseName] = useState("");
  const [videoReleaseName, setVideoReleaseName] = useState("");

  const bulkMutation = useCreateBulkSubmission();
  const initiateMutation = useInitiatePayment();
  const captureMutation = useCapturePayment();

  const activeFiles = tab === "song" ? songFiles : videoFiles;
  const activeUrls = tab === "song" ? songUrls : videoUrls;
  const songAllUploaded = songFiles.length > 0 && songUrls.every(u => u !== null);
  const videoAllUploaded = videoFiles.length > 0 && videoUrls.every(u => u !== null);
  const allUploaded = tab === "song" ? songAllUploaded : videoAllUploaded;

  // Auto-snap plan to the only valid tier whenever file count changes (tab switch, add, remove)
  useEffect(() => {
    if (activeFiles.length === 1) setPlan("single");
    else if (activeFiles.length > 1) setPlan("basic");
  }, [activeFiles.length]);
  const price = PLAN_PRICES[tab][plan];
  const effectiveSongType = songReleaseType || detectReleaseType(songFiles.length, "song");
  const effectiveVideoType = videoReleaseType || detectReleaseType(videoFiles.length, "video");
  const effectiveActiveType = tab === "song" ? effectiveSongType : effectiveVideoType;
  const activeReleaseName = tab === "song" ? songReleaseName : videoReleaseName;

  // ── File management helpers ───────────────────────────────────────────────
  function addFiles(newFiles: File[], type: "song" | "video") {
    const currentSong = songFiles.length;
    const currentVideo = videoFiles.length;
    const currentTotal = currentSong + currentVideo;
    const currentType = type === "song" ? currentSong : currentVideo;

    const remainingByType = MAX_FILES_PER_TYPE - currentType;
    const remainingByTotal = MAX_FILES_TOTAL - currentTotal;
    const canAdd = Math.min(remainingByType, remainingByTotal);

    if (canAdd <= 0) {
      toast({ title: "File limit reached", description: `Maximum ${MAX_FILES_TOTAL} files total across music and video.`, variant: "destructive" });
      return;
    }

    const allowed = newFiles.slice(0, canAdd);
    const skipped = newFiles.length - allowed.length;
    if (skipped > 0) {
      toast({ title: `${skipped} file${skipped !== 1 ? "s" : ""} not added`, description: `Limit is ${MAX_FILES_PER_TYPE} per type and ${MAX_FILES_TOTAL} total. ${allowed.length} file${allowed.length !== 1 ? "s" : ""} added.`, variant: "destructive" });
    }

    if (type === "song") {
      setSongFiles(prev => {
        const all = [...prev, ...allowed];
        setSongTitles(t => [...t, ...allowed.map(f => f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))]);
        setSongUrls(u => [...u, ...new Array(allowed.length).fill(null)]);
        return all;
      });
    } else {
      setVideoFiles(prev => {
        const all = [...prev, ...allowed];
        setVideoTitles(t => [...t, ...allowed.map(f => f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "))]);
        setVideoUrls(u => [...u, ...new Array(allowed.length).fill(null)]);
        return all;
      });
    }
  }

  function removeFile(i: number, type: "song" | "video") {
    if (type === "song") {
      setSongFiles(p => p.filter((_, idx) => idx !== i));
      setSongTitles(p => p.filter((_, idx) => idx !== i));
      setSongUrls(p => p.filter((_, idx) => idx !== i));
    } else {
      setVideoFiles(p => p.filter((_, idx) => idx !== i));
      setVideoTitles(p => p.filter((_, idx) => idx !== i));
      setVideoUrls(p => p.filter((_, idx) => idx !== i));
    }
  }

  const handleSongTitleChange = useCallback((i: number, t: string) => setSongTitles(p => p.map((v, idx) => idx === i ? t : v)), []);
  const handleVideoTitleChange = useCallback((i: number, t: string) => setVideoTitles(p => p.map((v, idx) => idx === i ? t : v)), []);
  const handleSongUrlSet = useCallback((i: number, url: string) => setSongUrls(p => p.map((v, idx) => idx === i ? url : v)), []);
  const handleVideoUrlSet = useCallback((i: number, url: string) => setVideoUrls(p => p.map((v, idx) => idx === i ? url : v)), []);

  // ── Step navigation ───────────────────────────────────────────────────────
  function handleStep0Next() {
    const meta = tab === "song" ? songMeta : videoMeta;
    const titles = tab === "song" ? songTitles : videoTitles;
    const releaseName = tab === "song" ? songReleaseName : videoReleaseName;
    const releaseType = tab === "song" ? effectiveSongType : effectiveVideoType;
    const needsReleaseName = releaseType !== "Single" && releaseType !== "Video";

    if (activeFiles.length === 0) {
      toast({ title: "No files selected", description: "Select at least one file to continue.", variant: "destructive" });
      return;
    }
    if (!allUploaded) {
      toast({ title: "Upload files first", description: "All files must finish uploading before continuing.", variant: "destructive" });
      return;
    }
    if (!meta.genre) {
      toast({ title: "Genre required", description: "Select a genre for your release.", variant: "destructive" });
      return;
    }
    if (needsReleaseName && !releaseName.trim()) {
      toast({ title: `${releaseType} title required`, description: `Enter a title for your ${releaseType}.`, variant: "destructive" });
      return;
    }
    const emptyTitle = titles.findIndex(t => !t.trim());
    if (emptyTitle !== -1) {
      toast({ title: "Track title required", description: `Track ${emptyTitle + 1} is missing a title.`, variant: "destructive" });
      return;
    }
    // Warn when the inactive tab also has files — those need a separate submission
    const inactiveCount = tab === "song" ? videoFiles.length : songFiles.length;
    const inactiveType  = tab === "song" ? "video" : "song";
    if (inactiveCount > 0) {
      toast({
        title: `Only your ${tab}s will be submitted`,
        description: `You also have ${inactiveCount} ${inactiveType}${inactiveCount !== 1 ? "s" : ""} loaded — those need a separate submission and payment after this one.`,
        duration: 7000,
      });
    }

    // Lock plan to match file count
    setPlan(activeFiles.length === 1 ? "single" : "basic");
    setStep(1);
  }

  // ── Payment flow ──────────────────────────────────────────────────────────
  const SUBMISSION_AGREEMENT_TYPES = [
    "content_ownership",
    "content_license_grant",
    "future_tech_use",
    "no_royalties",
    "fees_non_refundable",
    "indemnification",
  ] as const;

  async function recordSubmissionAgreements(submissionId: number) {
    const token = localStorage.getItem("cotopia_token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await Promise.all(
      SUBMISSION_AGREEMENT_TYPES.map(agreementType =>
        fetch(`${import.meta.env.BASE_URL}api/legal/agree`, {
          method: "POST",
          headers,
          body: JSON.stringify({ agreementType, agreementVersion: "1.0", submissionId }),
        })
      )
    );
  }

  async function handleCreateAndInitiate() {
    const meta = tab === "song" ? songMeta : videoMeta;
    const files = tab === "song"
      ? songTitles.map((title, i) => ({ title, fileUrl: songUrls[i]! }))
      : videoTitles.map((title, i) => ({ title, fileUrl: videoUrls[i]! }));

    const releaseName = tab === "song" ? songReleaseName : videoReleaseName;
    const releaseTypeLabel = tab === "song" ? effectiveSongType : effectiveVideoType;
    let descriptionWithRelease = meta.description;
    if (releaseName) {
      descriptionWithRelease = `${releaseTypeLabel}: "${releaseName}"${meta.description ? `\n\n${meta.description}` : ""}`;
    } else if (releaseTypeLabel !== "Single" && releaseTypeLabel !== "Video") {
      descriptionWithRelease = `[${releaseTypeLabel}]${meta.description ? ` ${meta.description}` : ""}`;
    }

    try {
      const submissions = await bulkMutation.mutateAsync({
        data: {
          type: tab,
          plan,
          artistName: lockedArtistName || undefined,
          labelName: meta.labelName || undefined,
          genre: meta.genre || undefined,
          mood: meta.mood || undefined,
          description: descriptionWithRelease || undefined,
          lyrics: tab === "song" ? (meta.lyrics || undefined) : undefined,
          credits: meta.credits || undefined,
          coverUrl: meta.coverUrl || undefined,
          releaseDate: meta.releaseDate || undefined,
          isExplicit: meta.isExplicit,
          files,
        },
      });

      const ids = (submissions as any[]).map((s: any) => s.id);
      setSubmissionIds(ids);
      setSuccessTitles((submissions as any[]).map((s: any) => s.title ?? ""));

      // Record all 12 agreement acceptances linked to this submission
      await recordSubmissionAgreements(ids[0]);

      // Initiate payment using the first submission id (represents the batch)
      initiateMutation.mutate({ data: { submissionId: ids[0] } }, {
        onSuccess: (payment: any) => { setPaypalOrderId(payment.paypalOrderId); setPaymentInitiated(true); },
        onError: () => toast({ variant: "destructive", title: "Payment initiation failed" }),
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Submission failed", description: err.message ?? "Check your details and try again." });
    }
  }

  function handleCapturePayment() {
    if (!submissionIds[0] || !paypalOrderId) return;
    captureMutation.mutate({ data: { submissionId: submissionIds[0], paypalOrderId } }, {
      onSuccess: () => setStep(3),
      onError: () => toast({ variant: "destructive", title: "Payment capture failed" }),
    });
  }

  const isCreating = bulkMutation.isPending || initiateMutation.isPending;

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Music className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Sign in to Submit</h2>
        <p className="text-muted-foreground">You need an account to submit music or video.</p>
        <Button onClick={() => setLocation("/login")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <Radio className="w-4 h-4" /><span>EVERYDAY RADIO</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Choose Your Creator Service</h1>
        <p className="text-muted-foreground">Select the publishing and review option that best fits your release.</p>
      </div>

      <VerifyEmailBanner action="submit content" />


      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i < step ? "bg-primary border-primary text-primary-foreground" :
                i === step ? "border-primary text-primary bg-primary/10" :
                "border-muted-foreground/30 text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Files & Details ── */}
      {step === 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Files & Details</h2>
              <p className="text-xs text-muted-foreground">Upload your files and fill in shared metadata</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={v => setTab(v as "song" | "video")}>
            <TabsList className="w-full">
              <TabsTrigger value="song" className="flex-1 gap-2">
                <ListMusic className="w-3.5 h-3.5" />Music
                {songFiles.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{songFiles.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="video" className="flex-1 gap-2">
                <ListVideo className="w-3.5 h-3.5" />Video
                {videoFiles.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{videoFiles.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="song" className="pt-5 space-y-6">
              <FileList
                files={songFiles}
                titles={songTitles}
                urls={songUrls}
                accept=".mp3,.wav,.m4a,.flac,audio/*"
                icon={Music}
                label="Audio Files"
                hint="MP3, WAV, M4A, FLAC"
                remaining={Math.min(MAX_FILES_PER_TYPE - songFiles.length, MAX_FILES_TOTAL - songFiles.length - videoFiles.length)}
                maxFiles={MAX_FILES_PER_TYPE}
                releaseType={songFiles.length > 0 ? effectiveSongType : undefined}
                onFilesSelected={fs => addFiles(fs, "song")}
                onTitleChange={handleSongTitleChange}
                onUrlSet={handleSongUrlSet}
                onRemove={i => removeFile(i, "song")}
              />
              {songFiles.length > 0 && (
                <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">{songFiles.length} track{songFiles.length !== 1 ? "s" : ""} — auto-grouped as</span>
                    <Badge className={`${releaseTypeBadgeClass(effectiveSongType)} text-xs px-2 py-0.5`}>{effectiveSongType}</Badge>
                    <div className="ml-auto flex-shrink-0">
                      <Select value={songReleaseType || effectiveSongType} onValueChange={setSongReleaseType}>
                        <SelectTrigger className="h-7 text-xs w-36 bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{MUSIC_RELEASE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {effectiveSongType !== "Single" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{effectiveSongType} Title</span>
                      <Input
                        placeholder={effectiveSongType === "EP" ? `e.g. "Midnight Dreams EP"` : `e.g. "Echoes of Tomorrow"`}
                        value={songReleaseName}
                        onChange={e => setSongReleaseName(e.target.value)}
                        className="flex-1 h-8 text-sm bg-background/50"
                      />
                    </div>
                  )}
                </div>
              )}
              {songFiles.length > 0 && (
                <div className="border-t border-border pt-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Shared Metadata (applies to all tracks)</p>
                  <MetadataSection meta={songMeta} onChange={setSongMeta} type="song" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="pt-5 space-y-6">
              <FileList
                files={videoFiles}
                titles={videoTitles}
                urls={videoUrls}
                accept=".mp4,.mov,.webm,video/*"
                icon={Film}
                label="Video Files"
                hint="MP4, MOV, WebM"
                remaining={Math.min(MAX_FILES_PER_TYPE - videoFiles.length, MAX_FILES_TOTAL - songFiles.length - videoFiles.length)}
                maxFiles={MAX_FILES_PER_TYPE}
                releaseType={videoFiles.length > 0 ? effectiveVideoType : undefined}
                onFilesSelected={fs => addFiles(fs, "video")}
                onTitleChange={handleVideoTitleChange}
                onUrlSet={handleVideoUrlSet}
                onRemove={i => removeFile(i, "video")}
              />
              {videoFiles.length > 0 && (
                <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">{videoFiles.length} video{videoFiles.length !== 1 ? "s" : ""} — auto-grouped as</span>
                    <Badge className={`${releaseTypeBadgeClass(effectiveVideoType)} text-xs px-2 py-0.5`}>{effectiveVideoType}</Badge>
                    <div className="ml-auto flex-shrink-0">
                      <Select value={videoReleaseType || effectiveVideoType} onValueChange={setVideoReleaseType}>
                        <SelectTrigger className="h-7 text-xs w-44 bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{VIDEO_RELEASE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {effectiveVideoType === "Video Collection" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Collection Title</span>
                      <Input
                        placeholder={`e.g. "Live at The Venue"`}
                        value={videoReleaseName}
                        onChange={e => setVideoReleaseName(e.target.value)}
                        className="flex-1 h-8 text-sm bg-background/50"
                      />
                    </div>
                  )}
                </div>
              )}
              {videoFiles.length > 0 && (
                <div className="border-t border-border pt-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Shared Metadata (applies to all videos)</p>
                  <MetadataSection meta={videoMeta} onChange={setVideoMeta} type="video" />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-2">
            <Button onClick={handleStep0Next} className="gap-2 px-6" disabled={activeFiles.length === 0}>
              Next: Choose Your Service <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: Plan ── */}
      {step === 1 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Choose Your Creator Service</h2>
              <p className="text-xs text-muted-foreground">Select the publishing and review option that best fits your release.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["single", "basic", "premium"] as const).map(p => {
              const isSelected = plan === p;
              const locked =
                (p === "single" && activeFiles.length > 1) ||
                ((p === "basic" || p === "premium") && activeFiles.length === 1);
              const icon = p === "single"
                ? <Music className={`w-5 h-5 ${locked ? "text-muted-foreground" : "text-primary"}`} />
                : p === "basic"
                  ? <Radio className="w-5 h-5 text-primary" />
                  : <Zap className="w-5 h-5 text-amber-400" />;
              const perLabel = "/ submission";
              const subtitle = p === "single"
                ? `Perfect for creators releasing one ${tab}.`
                : p === "basic"
                ? `Submit multiple ${tab}s together while saving time.`
                : "Premium review with consideration for additional visibility throughout Everyday Radio.";
              return (
                <button key={p} type="button"
                  onClick={() => !locked && setPlan(p)}
                  disabled={locked}
                  className={`relative p-5 rounded-xl border-2 transition-all text-left
                    ${locked ? "opacity-40 cursor-not-allowed border-border bg-secondary/10" :
                      isSelected ? "border-primary bg-primary/10" :
                      "border-border bg-secondary/20 hover:border-border/80"}`}>
                  {p === "premium" && !locked && (
                    <Badge className="absolute top-3 right-3 text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">⭐ Popular</Badge>
                  )}
                  {locked && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">
                      <AlertCircle className="w-2.5 h-2.5 text-destructive" />
                      <span className="text-[9px] text-destructive font-medium">
                        {p === "single" ? "1 file max" : "2+ files needed"}
                      </span>
                    </div>
                  )}
                  {isSelected && !locked && p !== "premium" && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                  {isSelected && !locked && p === "premium" && (
                    <Badge className="absolute top-3 right-3 text-[10px] bg-primary text-primary-foreground border-primary">✓ Selected</Badge>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    {icon}
                    <span className={`font-bold ${locked ? "text-muted-foreground" : ""}`}>{PLAN_NAMES[p]}</span>
                  </div>
                  <p className={`text-2xl font-extrabold mb-1 ${locked ? "text-muted-foreground" : ""}`}>
                    ${PLAN_PRICES[tab][p].toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{perLabel}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
                  {locked && (
                    <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                      <span className="text-[10px] text-destructive/80">
                        {p === "single"
                          ? `You have ${activeFiles.length} files — choose Batch Submission or Featured Placement.`
                          : "You have 1 file — only Single Submission is available."}
                      </span>
                    </div>
                  )}
                  <ul className="space-y-1.5">
                    {getPlanFeatures(tab)[p].map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${locked ? "text-muted-foreground/50" : "text-primary"}`} />{f}
                      </li>
                    ))}
                  </ul>
                  {p === "premium" && !locked && (
                    <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed border-t border-border/50 pt-2">
                      Payment does not guarantee approval. All submissions must follow Everyday Radio guidelines.
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-2">
              <ChevronLeft className="w-4 h-4" />Back
            </Button>
            <Button onClick={() => setStep(2)} className="gap-2 px-6">
              Next: Payment <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Payment ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Order Summary</h2>
                <p className="text-xs text-muted-foreground">Review before paying</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Content Type</span>
                <span className="font-medium capitalize">{tab}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Files in batch</span>
                <span className="font-medium">{activeFiles.length} {tab}{activeFiles.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{PLAN_NAMES[plan]}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Release Type</span>
                <Badge className={`${releaseTypeBadgeClass(effectiveActiveType)} text-xs`}>{effectiveActiveType}</Badge>
              </div>
              {activeReleaseName && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Release Title</span>
                  <span className="font-medium truncate max-w-[200px]">{activeReleaseName}</span>
                </div>
              )}
              {(tab === "song" ? songMeta : videoMeta).genre && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Genre</span>
                  <span className="font-medium">{(tab === "song" ? songMeta : videoMeta).genre}</span>
                </div>
              )}
              <div className="space-y-1 py-2 border-b border-border/50">
                <span className="text-muted-foreground text-xs">Tracks</span>
                {(tab === "song" ? songTitles : videoTitles).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs pl-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="truncate">{t || "(untitled)"}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-3 text-base">
                <span className="font-bold">Total</span>
                <span className="font-extrabold text-primary text-xl">${price.toFixed(2)}</span>
              </div>
              {(() => {
                const inactiveCount = tab === "song" ? videoFiles.length : songFiles.length;
                const inactiveType  = tab === "song" ? "video" : "song";
                if (inactiveCount === 0) return null;
                return (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300 leading-relaxed">
                      <strong>Heads up:</strong> You have {inactiveCount} {inactiveType}{inactiveCount !== 1 ? "s" : ""} loaded on the other tab.
                      This payment only covers your {tab}s above.
                      Return after this submission to pay for and submit your {inactiveType}s separately.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Legal Agreements ── */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-sm">Required Agreements</h3>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{legalChecks.filter(Boolean).length}/{LEGAL_TOTAL} accepted</span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={() => setLegalChecks(allLegalChecked ? Array(LEGAL_TOTAL).fill(false) : Array(LEGAL_TOTAL).fill(true))}
                >
                  {allLegalChecked ? "Uncheck all" : "Accept all"}
                </button>
              </div>
            </div>

            {/* Plain-language summary */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Before you submit — what you're agreeing to</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You keep ownership of your content, but by submitting it you give Cotopia and Everyday Radio broad rights to host, stream, promote, display, analyze, create derivative works, and use the content with current and future technologies, including AI and machine learning. Cotopia does not currently pay royalties or revenue share unless a separate written agreement says otherwise.
              </p>
              <p className="text-xs text-muted-foreground">
                See the{" "}
                <a href="/legal/content-license" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Content License and Rights Grant</a>
                {" "}and{" "}
                <a href="/legal/submission-agreement" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Submission Agreement</a>
                {" "}for full details.
              </p>
            </div>

            {!allLegalChecked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">You must accept all {LEGAL_TOTAL} declarations before proceeding to payment.</p>
              </div>
            )}

            <div className="space-y-2">
              {([
                { i: 0, text: "I own or control all rights necessary to upload this content." },
                { i: 1, label: <span>I grant Cotopia and Everyday Radio the <a href="/legal/content-license" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Content License and Rights Grant</a> described in the <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Terms of Service</a> and <a href="/legal/submission-agreement" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Submission Agreement</a>.</span> },
                { i: 2, text: "I understand Cotopia may use submitted content for hosting, streaming, promotion, display, playlists, discovery, analytics, AI, machine learning, and future platform technologies." },
                { i: 3, text: "I understand Everyday Radio by Cotopia does not currently pay streaming royalties, mechanical royalties, performance royalties, publishing royalties, or revenue sharing unless covered by a separate written agreement." },
                { i: 4, text: "I understand submission and promotion fees are non-refundable once review begins." },
                { i: 5, text: "I agree to defend, indemnify, and hold harmless Cotopia and its related entities if my upload causes legal claims." },
              ] as { i: number; text?: string; label?: React.ReactNode }[]).map(({ i, text, label }) => (
                <div key={i} className="flex items-start gap-3 py-1">
                  <Checkbox
                    id={`legal-${i}`}
                    checked={legalChecks[i]}
                    onCheckedChange={v => { const next = [...legalChecks]; next[i] = Boolean(v); setLegalChecks(next); }}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <label htmlFor={`legal-${i}`} className="text-xs text-muted-foreground leading-relaxed cursor-pointer">{label ?? text}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300"><strong>Demo Mode:</strong> This is a simulated PayPal payment. No real charges.</p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <strong>Important Notice:</strong> Approval is based on Everyday Radio's publishing guidelines. Purchasing a Creator Service does not guarantee publication or featured placement.
              </p>
            </div>

            {!paymentInitiated ? (
              <Button className="w-full h-12 text-base gap-3 bg-[#0070ba] hover:bg-[#005ea6] text-white" onClick={handleCreateAndInitiate} disabled={!allLegalChecked || isCreating}>
                {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <><CreditCard className="w-5 h-5" />Continue to Secure Checkout — ${price.toFixed(2)}</>}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-400">PayPal order created!</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{paypalOrderId}</p>
                  </div>
                </div>
                <Button className="w-full h-12 text-base gap-3" onClick={handleCapturePayment} disabled={captureMutation.isPending}>
                  {captureMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Confirming…</> : <><CheckCircle className="w-5 h-5" />Confirm Payment — Complete Submission</>}
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => { setStep(1); setPaymentInitiated(false); setPaypalOrderId(null); }} className="gap-2">
              <ChevronLeft className="w-4 h-4" />Back
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 3 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-10 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold">Creator Service Received</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Thank you for your submission. Your content has been added to the review queue. You will receive updates as your submission moves through the review process.
            </p>
          </div>
          {successTitles.length > 1 && (
            <div className="text-left max-w-xs mx-auto space-y-1">
              {successTitles.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="truncate">{t || "(untitled)"}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20 max-w-xs mx-auto">
            <Radio className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Status: <span className="text-primary">Received</span></p>
          </div>
          {(() => {
            const inactiveCount = tab === "song" ? videoFiles.length : songFiles.length;
            const inactiveType  = tab === "song" ? "video" : "song";
            if (inactiveCount === 0) return null;
            const isSongActive = tab === "song";
            return (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left max-w-sm mx-auto">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-amber-300">You still have {inactiveType}s to submit</p>
                    <p className="text-xs text-muted-foreground">
                      {inactiveCount} {inactiveType}{inactiveCount !== 1 ? "s" : ""} from the other tab need a separate submission and payment.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    // Switch to the inactive tab, clear the just-submitted type's state,
                    // keep the other tab's files so the user continues from where they left off
                    setTab(inactiveType as "song" | "video");
                    setStep(0);
                    setPaypalOrderId(null);
                    setPaymentInitiated(false);
                    setSubmissionIds([]);
                    setSuccessTitles([]);
                    if (isSongActive) {
                      setSongFiles([]); setSongTitles([]); setSongUrls([]); setSongMeta({ ...defaultMeta });
                      setSongReleaseType(""); setSongReleaseName("");
                    } else {
                      setVideoFiles([]); setVideoTitles([]); setVideoUrls([]); setVideoMeta({ ...defaultMeta });
                      setVideoReleaseType(""); setVideoReleaseName("");
                    }
                  }}
                >
                  {inactiveType === "video" ? <Film className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                  Submit my {inactiveType}s now
                </Button>
              </div>
            );
          })()}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={() => setLocation("/submissions")} className="gap-2">
              <FileText className="w-4 h-4" />View My Reviews
            </Button>
            <Button variant="outline" onClick={() => {
              setStep(0); setPaypalOrderId(null); setPaymentInitiated(false); setSubmissionIds([]); setSuccessTitles([]);
              setSongFiles([]); setSongTitles([]); setSongUrls([]); setSongMeta({ ...defaultMeta });
              setVideoFiles([]); setVideoTitles([]); setVideoUrls([]); setVideoMeta({ ...defaultMeta });
              setSongReleaseType(""); setVideoReleaseType("");
              setSongReleaseName(""); setVideoReleaseName("");
            }}>
              Submit More
            </Button>
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      {step < 3 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-sm">Frequently Asked Questions</h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-1">What does the Creator Service fee cover?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                The Creator Service fee covers the cost of professional review, content processing, and platform hosting. It ensures your submission receives dedicated attention from our editorial team.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Does payment guarantee my content will be published?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                No. Purchasing a Creator Service does not guarantee publication or featured placement. All submissions are reviewed against Everyday Radio's publishing guidelines and editorial standards.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Can I resubmit if my content is declined?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Yes. If your submission is declined, you are welcome to make the necessary adjustments and submit again. Each submission requires a new Creator Service purchase.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Beta notice ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground">
        <Radio className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="text-foreground font-medium">Everyday Radio is currently in Beta.</span> Thank you for helping us improve the platform. Your feedback helps shape future updates.
        </p>
      </div>
    </div>
  );
}
