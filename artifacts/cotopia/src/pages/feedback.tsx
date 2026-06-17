import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateFeedback, useListMyFeedback, getListMyFeedbackQueryKey, type FeedbackInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bug, Lightbulb, MessageSquare, Send, Loader2, Sparkles, Inbox, ImagePlus, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUpload } from "@workspace/object-storage-web";

const TYPE_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  bug: { label: "Bug Report", icon: Bug, className: "bg-red-500/15 text-red-400 border-red-500/30" },
  feature: { label: "Feature Request", icon: Lightbulb, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  general: { label: "General Feedback", icon: MessageSquare, className: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  resolved: { label: "Resolved", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  closed: { label: "Closed", className: "bg-secondary text-muted-foreground border-border" },
};

export default function Feedback() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<"bug" | "feature" | "general">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const { uploadFile: uploadScreenshot, isUploading: isUploadingScreenshot, progress: screenshotProgress } = useUpload({
    onSuccess: (res) => setScreenshotUrl(`/api/storage${res.objectPath}`),
    onError: () => toast({ variant: "destructive", title: "Screenshot upload failed" }),
  });

  const { data: mine, isLoading } = useListMyFeedback();

  const submitMutation = useCreateFeedback({
    mutation: {
      onSuccess: () => {
        toast({ title: "Feedback submitted", description: "Thank you for helping shape Cotopia!" });
        setType("bug");
        setTitle("");
        setDescription("");
        setScreenshotUrl("");
        qc.invalidateQueries({ queryKey: getListMyFeedbackQueryKey() });
      },
      onError: (err) =>
        toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not submit feedback" }),
    },
  });

  const handleSubmit = () => {
    submitMutation.mutate({
      data: {
        type: type as FeedbackInput["type"],
        title,
        description,
        screenshotUrl: screenshotUrl.trim() || undefined,
      },
    });
  };

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitMutation.isPending;
  const submissions = mine ?? [];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Beta Program</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Beta Feedback</h1>
        <p className="text-muted-foreground max-w-2xl">
          Cotopia is in active beta. Your feedback directly shapes the platform — report bugs you hit,
          suggest features you'd love to see, or share general thoughts. We read everything.
        </p>
      </div>

      {/* Submission form */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-bold">Share your feedback</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</label>
          <Select value={type} onValueChange={(v) => setType(v as "bug" | "feature" | "general")}>
            <SelectTrigger className="bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="general">General Feedback</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Title</label>
          <Input
            placeholder="A short summary…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-secondary/50 border-secondary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Description</label>
          <Textarea
            placeholder="Tell us what happened or what you'd like to see. Include steps to reproduce if it's a bug."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="bg-secondary/50 border-secondary resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Screenshot <span className="normal-case text-muted-foreground/60">(optional)</span>
          </label>
          {screenshotUrl ? (
            <div className="relative inline-block">
              <img
                src={screenshotUrl}
                alt="Screenshot preview"
                className="max-h-48 rounded-lg border border-border object-contain bg-secondary/30"
              />
              <button
                type="button"
                onClick={() => setScreenshotUrl("")}
                className="absolute -top-2 -right-2 rounded-full bg-background border border-border p-1 text-muted-foreground hover:text-destructive shadow-sm"
                title="Remove screenshot"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-24 rounded-lg border border-dashed border-border bg-secondary/30 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-foreground transition-colors">
              {isUploadingScreenshot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading… {screenshotProgress}%
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  Click to attach a screenshot
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingScreenshot}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadScreenshot(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            className="gap-1.5"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Feedback
          </Button>
        </div>
      </div>

      {/* Your submissions */}
      <div className="space-y-4 max-w-2xl">
        <h2 className="text-lg font-bold">Your submissions</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
            <p>You haven't submitted any feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((f) => {
              const typeMeta = TYPE_META[f.type] ?? TYPE_META.general;
              const statusMeta = STATUS_META[f.status] ?? STATUS_META.open;
              const TypeIcon = typeMeta.icon;
              return (
                <div key={f.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{f.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${typeMeta.className} border text-[10px] uppercase gap-1`}>
                          <TypeIcon className="w-2.5 h-2.5" />{typeMeta.label}
                        </Badge>
                        <Badge className={`${statusMeta.className} border text-[10px] uppercase`}>
                          {statusMeta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.description}</p>
                  {f.adminNotes && (
                    <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">Admin response</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{f.adminNotes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
