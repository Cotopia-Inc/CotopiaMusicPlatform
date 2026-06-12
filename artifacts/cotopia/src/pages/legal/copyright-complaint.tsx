import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function CopyrightComplaint() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    claimantName: "",
    claimantEmail: "",
    claimantCompany: "",
    copyrightOwner: "",
    workDescription: "",
    infringingUrl: "",
    signature: "",
    goodFaithStatement: false,
    accuracyStatement: false,
  });

  const update = (field: string, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const canSubmit =
    form.claimantName && form.claimantEmail && form.copyrightOwner &&
    form.workDescription && form.infringingUrl && form.signature &&
    form.goodFaithStatement && form.accuracyStatement && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/legal/dmca-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      toast({ title: "Submission failed", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-card rounded-xl border border-border p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Complaint Received</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your DMCA complaint has been submitted. We will review it and respond to your email address within 3–5 business days.
            </p>
          </div>
          <Link href="/legal/dmca">
            <Button variant="outline" size="sm">View DMCA Policy</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-1">
        <Link href="/legal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="w-3 h-3" />Legal Center
        </Link>
        <h1 className="text-3xl font-extrabold">File a Copyright Complaint</h1>
        <p className="text-xs text-muted-foreground">Everyday Radio by Cotopia · DMCA Takedown Form</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          Filing a false or bad-faith DMCA claim is a violation of platform policy and may constitute perjury. Only submit this form if you have a genuine good-faith belief that your copyright has been infringed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Your Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name <span className="text-red-400">*</span></Label>
              <Input id="name" placeholder="Your legal name" value={form.claimantName} onChange={e => update("claimantName", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address <span className="text-red-400">*</span></Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.claimantEmail} onChange={e => update("claimantEmail", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company">Company / Organization <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="company" placeholder="Your company or label name" value={form.claimantCompany} onChange={e => update("claimantCompany", e.target.value)} className="bg-secondary/50 border-secondary" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner">Copyright Owner <span className="text-red-400">*</span></Label>
            <Input id="owner" placeholder="Name of the rights holder (you or your client)" value={form.copyrightOwner} onChange={e => update("copyrightOwner", e.target.value)} className="bg-secondary/50 border-secondary" />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Infringement Details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="work">Description of Copyrighted Work <span className="text-red-400">*</span></Label>
            <Textarea id="work" placeholder={"Describe the copyrighted work you own (e.g., \"The song 'Song Title' released in 2023 on [Label]\")"} value={form.workDescription} onChange={e => update("workDescription", e.target.value)} rows={3} className="bg-secondary/50 border-secondary resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">URL of Infringing Content <span className="text-red-400">*</span></Label>
            <Input id="url" placeholder="https://everydayradio.com/songs/..." value={form.infringingUrl} onChange={e => update("infringingUrl", e.target.value)} className="bg-secondary/50 border-secondary" />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Required Statements</h2>

          <div className="flex items-start gap-3">
            <Checkbox id="good-faith" checked={form.goodFaithStatement} onCheckedChange={v => update("goodFaithStatement", Boolean(v))} className="mt-0.5" />
            <Label htmlFor="good-faith" className="text-sm font-normal cursor-pointer leading-relaxed">
              I have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox id="accuracy" checked={form.accuracyStatement} onCheckedChange={v => update("accuracyStatement", Boolean(v))} className="mt-0.5" />
            <Label htmlFor="accuracy" className="text-sm font-normal cursor-pointer leading-relaxed">
              I swear, under penalty of perjury, that the information in this notice is accurate, and that I am the copyright owner or am authorized to act on behalf of the owner.
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signature">Electronic Signature <span className="text-red-400">*</span></Label>
            <Input id="signature" placeholder="Type your full legal name as your electronic signature" value={form.signature} onChange={e => update("signature", e.target.value)} className="bg-secondary/50 border-secondary" />
            <p className="text-xs text-muted-foreground">Typing your name constitutes a legal electronic signature.</p>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gap-2" disabled={!canSubmit}>
          {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : "Submit DMCA Complaint"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          By submitting, you confirm you have read our <Link href="/legal/dmca" className="text-primary hover:underline">DMCA Policy</Link>.
        </p>
      </form>
    </div>
  );
}
