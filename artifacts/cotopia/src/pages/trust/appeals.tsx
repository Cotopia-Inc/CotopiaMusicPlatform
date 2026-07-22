import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Flag, ChevronLeft, CheckCircle, Tag, Lock, Info } from "lucide-react";
import { useSubmitTrustAppeal } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const ACTION_OPTIONS = [
  "Content rejection",
  "Content removal",
  "Account restriction",
  "Badge removal",
  "Verification denial",
  "Support Wall moderation",
  "AI authorship tag dispute",
  "Copyright action",
  "Other",
];

const STATUSES = ["Submitted", "Under Review", "Evidence Requested", "Upheld", "Reversed", "Modified", "Closed"];

const TAG_LABELS: Record<string, string> = {
  human_created: "Human Created",
  ai_assisted: "AI Assisted",
  human_ai_collab: "Human + AI Collaboration",
  fully_ai_generated: "Fully AI Generated",
  unclassified: "Unclassified",
};

export default function TrustAppeals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  // Parse query params for pre-population from a locked-tag notice
  const params = new URLSearchParams(window.location.search);
  const qContentType = params.get("contentType") as "song" | "video" | null;
  const qContentIdStr = params.get("contentId");
  const qContentId = qContentIdStr ? parseInt(qContentIdStr, 10) : null;
  const hasContentLink = Boolean(qContentType && qContentId && !isNaN(qContentId));

  const [classificationCtx, setClassificationCtx] = useState<{
    title: string;
    effectiveDisplayTag: string;
    tagLocked: boolean;
    aiOverrideReason: string | null;
  } | null>(null);

  // Fetch classification context when navigated from a locked-tag notice
  useEffect(() => {
    if (!hasContentLink) return;
    const base = import.meta.env.BASE_URL;
    const token = localStorage.getItem("cotopia_token");
    const path = qContentType === "song" ? `${base}api/songs/${qContentId}` : `${base}api/videos/${qContentId}`;
    fetch(path, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, unknown> | null) => {
        if (!data) return;
        setClassificationCtx({
          title: (data["title"] as string) ?? "",
          effectiveDisplayTag: (data["effectiveDisplayTag"] as string) ?? "unclassified",
          tagLocked: Boolean(data["tagLocked"]),
          aiOverrideReason: (data["aiOverrideReason"] as string | null) ?? null,
        });
      })
      .catch(() => {});
  }, [hasContentLink, qContentType, qContentId]);

  const [form, setForm] = useState({
    submitterName: user?.displayName ?? user?.username ?? "",
    submitterEmail: user?.email ?? "",
    actionType: hasContentLink ? "AI authorship tag dispute" : "",
    relatedContent: "",
    reason: "",
    supportingInfo: "",
  });

  const mutation = useSubmitTrustAppeal({
    mutation: {
      onSuccess: () => setSubmitted(true),
      onError: () => toast({ variant: "destructive", title: "Could not submit your appeal. Please try again." }),
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.actionType || !form.reason.trim()) {
      toast({ variant: "destructive", title: "Please fill in all required fields." });
      return;
    }
    mutation.mutate({
      data: {
        submitterName: form.submitterName || undefined,
        submitterEmail: form.submitterEmail || undefined,
        actionType: form.actionType,
        relatedContent: form.relatedContent || undefined,
        reason: form.reason,
        supportingInfo: form.supportingInfo || undefined,
        contentType: (hasContentLink && qContentType) ? qContentType : undefined,
        contentId: (hasContentLink && qContentId) ? qContentId : undefined,
      },
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Appeal Submitted</h1>
          <p className="text-muted-foreground leading-relaxed">
            Your appeal has been received. Our team will review it and respond as soon as possible.
            You do not need to resubmit — we have your request.
          </p>
          <p className="text-sm text-muted-foreground">
            Appeal status moves through: <span className="font-medium text-foreground">{STATUSES.join(" → ")}</span>
          </p>
          <Link href="/trust">
            <button className="mt-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors">
              Back to Trust Center
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center">
          <Link href="/trust/moderation">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />Appeals
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 pb-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-red-400/10 flex items-center justify-center">
            <Flag className="w-4.5 h-4.5 text-red-400" />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Appeals</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">Submit an Appeal</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          If you believe a platform decision was made in error, you can request a review here.
          All appeals are reviewed by our team. Submitting an appeal does not guarantee a reversal.
        </p>

        {/* Classification context banner — shown when navigated from a locked-tag notice */}
        {hasContentLink && (
          <div className="mb-6 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-violet-300">AI Classification Dispute</p>
            </div>
            {classificationCtx ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You are disputing the classification of: <span className="font-medium text-foreground">{classificationCtx.title}</span>
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1.5">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Current tag:</span>
                    <span className="font-medium text-foreground">{TAG_LABELS[classificationCtx.effectiveDisplayTag] ?? classificationCtx.effectiveDisplayTag}</span>
                  </div>
                  {classificationCtx.tagLocked && (
                    <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300 text-xs">Classification locked by platform review</span>
                    </div>
                  )}
                </div>
                {classificationCtx.aiOverrideReason && (
                  <div className="flex items-start gap-1.5 rounded-md bg-secondary/30 px-2.5 py-1.5">
                    <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Decision reason:</span> {classificationCtx.aiOverrideReason}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Loading classification details…</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="submitterName">Your Name</label>
              <input
                id="submitterName" name="submitterName" type="text"
                value={form.submitterName} onChange={handleChange}
                placeholder={user ? "" : "Optional"}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="submitterEmail">Your Email</label>
              <input
                id="submitterEmail" name="submitterEmail" type="email"
                value={form.submitterEmail} onChange={handleChange}
                placeholder={user ? "" : "Optional but helps us respond"}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="actionType">
              Action Being Appealed <span className="text-red-400">*</span>
            </label>
            <select
              id="actionType" name="actionType" value={form.actionType} onChange={handleChange} required
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select an action type…</option>
              {ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="relatedContent">Related Content or Account</label>
            <input
              id="relatedContent" name="relatedContent" type="text"
              value={form.relatedContent} onChange={handleChange}
              placeholder="Song title, video URL, username, or other identifier"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="reason">
              Reason for Appeal <span className="text-red-400">*</span>
            </label>
            <textarea
              id="reason" name="reason" rows={5} required minLength={10}
              value={form.reason} onChange={handleChange}
              placeholder="Explain clearly why you believe this decision was incorrect or should be reconsidered."
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="supportingInfo">Supporting Information</label>
            <textarea
              id="supportingInfo" name="supportingInfo" rows={3}
              value={form.supportingInfo} onChange={handleChange}
              placeholder="Any additional context, links, or evidence that supports your appeal."
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="p-4 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground space-y-1">
            <p>Appeals are reviewed in the order they are received. Your appeal status will follow these stages:</p>
            <p className="font-medium text-foreground">{STATUSES.join(" → ")}</p>
            <p>We may contact you at the email address provided if more information is needed.</p>
          </div>

          <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
            {mutation.isPending ? "Submitting…" : "Submit Appeal"}
          </Button>
        </form>
      </main>
    </div>
  );
}
