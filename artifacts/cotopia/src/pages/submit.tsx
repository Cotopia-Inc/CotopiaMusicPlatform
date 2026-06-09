import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateSubmission,
  useInitiatePayment,
  useCapturePayment,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Music, Video, CheckCircle, CreditCard, FileText,
  ChevronRight, ChevronLeft, Radio, Star, Zap, Upload,
  Calendar, AlertCircle, Loader2, ImageIcon, Film, Mic
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";

const GENRES = ["Pop", "Hip-Hop", "R&B", "Electronic", "Rock", "Jazz", "Classical", "Country", "Reggae", "Latin", "Afrobeats", "Indie", "Alternative", "Metal", "Folk", "Soul", "Blues", "Other"];
const MOODS = ["Energetic", "Chill", "Romantic", "Dark", "Happy", "Melancholic", "Motivational", "Party", "Peaceful", "Nostalgic", "Intense", "Dreamy"];

const detailsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  artistName: z.string().optional(),
  labelName: z.string().optional(),
  genre: z.string().optional(),
  mood: z.string().optional(),
  description: z.string().max(1000).optional(),
  fileUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  releaseDate: z.string().optional(),
  isExplicit: z.boolean().default(false),
});

const planSchema = z.object({
  type: z.enum(["song", "video"]),
  plan: z.enum(["basic", "premium"]),
});

type DetailsValues = z.infer<typeof detailsSchema>;
type PlanValues = z.infer<typeof planSchema>;

const PLAN_PRICES = {
  song: { basic: 9.99, premium: 29.99 },
  video: { basic: 14.99, premium: 44.99 },
};

const PLAN_FEATURES = {
  basic: ["Review within 7 days", "Standard placement", "Artist profile listing"],
  premium: ["Priority review within 48 hours", "Featured placement", "Social media spotlight", "Radio scheduling", "Analytics report"],
};

const STEPS = ["Content Details", "Type & Plan", "Payment", "Complete"];

// ── File upload field ──────────────────────────────────────────────────────
interface FileUploadFieldProps {
  label: string;
  accept: string;
  icon: React.ReactNode;
  hint: string;
  value: string;
  onChange: (url: string, filename: string) => void;
  urlPlaceholder: string;
}

function FileUploadField({ label, accept, icon, hint, value, onChange, urlPlaceholder }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string>("");
  const [urlMode, setUrlMode] = useState(false);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onChange(`/api/storage${res.objectPath}`, filename);
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    await uploadFile(file);
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
        <span className="text-muted-foreground text-xs font-normal">(optional)</span>
      </p>

      {!urlMode ? (
        <div className="space-y-2">
          <div
            onClick={() => !isUploading && inputRef.current?.click()}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all group ${isUploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              {isUploading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              {isUploading ? (
                <div>
                  <p className="text-sm font-medium text-foreground truncate">{filename}</p>
                  <p className="text-xs text-primary mt-0.5">Uploading… {progress}%</p>
                </div>
              ) : filename && value ? (
                <div>
                  <p className="text-sm font-medium text-foreground truncate">{filename}</p>
                  <p className="text-xs text-green-400 mt-0.5">Uploaded ✓</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Click to upload from device</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                </div>
              )}
            </div>
            {filename && value && !isUploading && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFilename(""); onChange("", ""); if (inputRef.current) inputRef.current.value = ""; }}
                className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
              >
                Remove
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" disabled={isUploading} />
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="text-xs text-primary hover:underline"
          >
            Or paste a URL instead
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={value.startsWith("/api/storage") ? "" : value}
            onChange={(e) => onChange(e.target.value, "")}
            placeholder={urlPlaceholder}
            className="bg-secondary/50 border-secondary"
          />
          <button
            type="button"
            onClick={() => setUrlMode(false)}
            className="text-xs text-primary hover:underline"
          >
            ← Upload from device instead
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function Submit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(0);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [planValues, setPlanValues] = useState<PlanValues>({ type: "song", plan: "basic" });

  const createMutation = useCreateSubmission();
  const initiateMutation = useInitiatePayment();
  const captureMutation = useCapturePayment();

  const detailsForm = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: "",
      artistName: user?.username ?? "",
      labelName: "",
      genre: "",
      mood: "",
      description: "",
      fileUrl: "",
      coverUrl: "",
      releaseDate: "",
      isExplicit: false,
    },
  });

  const planForm = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { type: "song", plan: "basic" },
  });

  const watchType = planForm.watch("type");
  const watchPlan = planForm.watch("plan");
  const price = PLAN_PRICES[watchType]?.[watchPlan] ?? 9.99;

  const onDetailsNext = detailsForm.handleSubmit(() => setStep(1));
  const onPlanNext = planForm.handleSubmit((values) => { setPlanValues(values); setStep(2); });

  const handleCreateAndInitiate = () => {
    const details = detailsForm.getValues();
    const plan = planForm.getValues();

    createMutation.mutate({
      data: {
        type: plan.type,
        plan: plan.plan,
        title: details.title,
        artistName: details.artistName || undefined,
        labelName: details.labelName || undefined,
        genre: details.genre || undefined,
        mood: details.mood || undefined,
        description: details.description || undefined,
        fileUrl: details.fileUrl || undefined,
        coverUrl: details.coverUrl || undefined,
        releaseDate: details.releaseDate || undefined,
        isExplicit: details.isExplicit,
      },
    }, {
      onSuccess: (submission) => {
        setSubmissionId(submission.id);
        initiateMutation.mutate({ data: { submissionId: submission.id } }, {
          onSuccess: (payment) => { setPaypalOrderId(payment.paypalOrderId); setPaymentInitiated(true); },
          onError: () => toast({ variant: "destructive", title: "Payment initiation failed" }),
        });
      },
      onError: () => toast({ variant: "destructive", title: "Submission creation failed", description: "Check your details and try again." }),
    });
  };

  const handleCapturePayment = () => {
    if (!submissionId || !paypalOrderId) return;
    captureMutation.mutate({ data: { submissionId, paypalOrderId } }, {
      onSuccess: () => setStep(3),
      onError: () => toast({ variant: "destructive", title: "Payment capture failed" }),
    });
  };

  const isLoading = createMutation.isPending || initiateMutation.isPending;

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
          <Radio className="w-4 h-4" />
          <span>EVERYDAY RADIO</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Submit Your Content</h1>
        <p className="text-muted-foreground">Get your music or video in front of our audience.</p>
      </div>

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

      {/* ── Step 0: Content Details ── */}
      {step === 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Content Details</h2>
              <p className="text-xs text-muted-foreground">Tell us about your track or video</p>
            </div>
          </div>

          <Form {...detailsForm}>
            <form onSubmit={onDetailsNext} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField control={detailsForm.control} name="title" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Summer Nights" {...field} className="bg-secondary/50 border-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="artistName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist / Stage Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your artist name" {...field} className="bg-secondary/50 border-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="labelName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label Name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Neon Records" {...field} className="bg-secondary/50 border-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="genre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50 border-secondary">
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="mood" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mood</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50 border-secondary">
                          <SelectValue placeholder="Select mood" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="description" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about this track — the story, the inspiration, the vibe..."
                        rows={3}
                        className="bg-secondary/50 border-secondary resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Audio/video file upload */}
                <div className="md:col-span-2">
                  <FormField control={detailsForm.control} name="fileUrl" render={({ field }) => (
                    <FormItem>
                      <FileUploadField
                        label="Audio / Video File"
                        accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,audio/*,video/*"
                        icon={<Mic className="w-3.5 h-3.5" />}
                        hint="MP3, WAV, M4A, MP4, MOV, WebM accepted"
                        value={field.value ?? ""}
                        onChange={(url) => field.onChange(url)}
                        urlPlaceholder="https://drive.google.com/... or https://soundcloud.com/..."
                      />
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Cover image upload */}
                <div className="md:col-span-2">
                  <FormField control={detailsForm.control} name="coverUrl" render={({ field }) => (
                    <FormItem>
                      <FileUploadField
                        label="Cover / Thumbnail Image"
                        accept=".jpg,.jpeg,.png,.webp,image/*"
                        icon={<ImageIcon className="w-3.5 h-3.5" />}
                        hint="JPG, PNG, or WebP — minimum 500×500px recommended"
                        value={field.value ?? ""}
                        onChange={(url) => field.onChange(url)}
                        urlPlaceholder="https://... (direct image URL)"
                      />
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={detailsForm.control} name="releaseDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      Release Date <span className="text-muted-foreground text-xs">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-secondary/50 border-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={detailsForm.control} name="isExplicit" render={({ field }) => (
                  <FormItem className="flex items-center">
                    <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/20 w-full mt-5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          field.value ? "bg-primary border-primary" : "border-muted-foreground/50 bg-transparent"
                        }`}
                      >
                        {field.value && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                      </button>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          Explicit Content
                          {field.value && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">E</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">Contains explicit language or themes.</p>
                      </div>
                    </div>
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" className="gap-2 px-6">
                  Next: Choose Plan <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* ── Step 1: Type & Plan ── */}
      {step === 1 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Content Type & Submission Plan</h2>
              <p className="text-xs text-muted-foreground">Choose content type and the level of exposure you want</p>
            </div>
          </div>

          <Form {...planForm}>
            <form onSubmit={onPlanNext} className="space-y-6">
              <div>
                <p className="text-sm font-semibold mb-3">What are you submitting?</p>
                <FormField control={planForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 gap-3">
                      {(["song", "video"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => field.onChange(t)}
                          className={`relative p-5 rounded-xl border-2 transition-all text-left ${field.value === t ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:border-border/80"}`}>
                          {t === "song" ? <Music className="w-7 h-7 mb-2 text-primary" /> : <Film className="w-7 h-7 mb-2 text-primary" />}
                          <p className="font-bold capitalize">{t}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t === "song" ? "Audio track or single" : "Music video or visual content"}</p>
                          {field.value === t && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div>
                <p className="text-sm font-semibold mb-3">Choose your plan</p>
                <FormField control={planForm.control} name="plan" render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(["basic", "premium"] as const).map((p) => (
                        <button key={p} type="button" onClick={() => field.onChange(p)}
                          className={`relative p-5 rounded-xl border-2 transition-all text-left ${field.value === p ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:border-border/80"}`}>
                          {p === "premium" && (
                            <Badge className="absolute top-3 right-3 text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">⭐ Popular</Badge>
                          )}
                          <div className="flex items-center gap-2 mb-3">
                            {p === "basic" ? <Radio className="w-5 h-5 text-primary" /> : <Zap className="w-5 h-5 text-amber-400" />}
                            <span className="font-bold capitalize">{p}</span>
                          </div>
                          <p className="text-2xl font-extrabold mb-3">
                            ${PLAN_PRICES[watchType][p].toFixed(2)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">/ submission</span>
                          </p>
                          <ul className="space-y-1.5">
                            {PLAN_FEATURES[p].map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button type="submit" className="gap-2 px-6">
                  Next: Payment <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </Form>
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
                <span className="text-muted-foreground">Title</span>
                <span className="font-medium">{detailsForm.getValues("title")}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Content Type</span>
                <span className="font-medium capitalize">{planValues.type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{planValues.plan}</span>
              </div>
              {detailsForm.getValues("genre") && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Genre</span>
                  <span className="font-medium">{detailsForm.getValues("genre")}</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-base">
                <span className="font-bold">Total</span>
                <span className="font-extrabold text-primary text-xl">${price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300"><strong>Demo Mode:</strong> This is a simulated PayPal payment. No real charges.</p>
            </div>

            {!paymentInitiated ? (
              <Button className="w-full h-12 text-base gap-3 bg-[#0070ba] hover:bg-[#005ea6] text-white" onClick={handleCreateAndInitiate} disabled={isLoading}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><CreditCard className="w-5 h-5" /> Pay ${price.toFixed(2)} with PayPal</>}
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
                  {captureMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</> : <><CheckCircle className="w-5 h-5" /> Confirm Payment — Complete Submission</>}
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => { setStep(1); setPaymentInitiated(false); setPaypalOrderId(null); }} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
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
            <h2 className="text-2xl font-extrabold">Submission Received!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              <strong className="text-foreground">{detailsForm.getValues("title")}</strong> has been submitted for review.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20 max-w-xs mx-auto">
            <Radio className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Status: <span className="text-primary">Pending Review</span></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={() => setLocation("/submissions")} className="gap-2">
              <FileText className="w-4 h-4" /> View My Submissions
            </Button>
            <Button variant="outline" onClick={() => { setStep(0); setSubmissionId(null); setPaypalOrderId(null); setPaymentInitiated(false); detailsForm.reset(); planForm.reset(); }}>
              Submit Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
