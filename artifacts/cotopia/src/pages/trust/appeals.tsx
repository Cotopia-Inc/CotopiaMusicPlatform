import { useState } from "react";
import { Link } from "wouter";
import { Flag, ChevronLeft, CheckCircle } from "lucide-react";
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

const STATUSES = ["Received", "Under Review", "More Information Needed", "Upheld", "Reversed", "Closed"];

export default function TrustAppeals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    submitterName: user?.displayName ?? user?.username ?? "",
    submitterEmail: user?.email ?? "",
    actionType: "",
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
