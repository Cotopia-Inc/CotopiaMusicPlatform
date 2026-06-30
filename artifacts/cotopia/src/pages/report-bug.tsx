import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bug, Send, CheckCircle2, Loader2 } from "lucide-react";

const SEVERITIES = [
  { value: "low", label: "Low — minor annoyance" },
  { value: "medium", label: "Medium — it slows me down" },
  { value: "high", label: "High — major feature broken" },
  { value: "urgent", label: "Urgent — can't use the app" },
];

const authHeaders = () => {
  const token = localStorage.getItem("cotopia_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

export default function ReportBug() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    whatHappened: "",
    pageUrl: typeof window !== "undefined" ? window.location.href : "",
    whatTrying: "",
    severity: "medium",
    userEmail: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        whatHappened: form.whatHappened,
        severity: form.severity,
      };
      if (form.pageUrl.trim()) body.pageUrl = form.pageUrl;
      if (form.whatTrying.trim()) body.whatTrying = form.whatTrying;
      if (form.userEmail.trim()) body.userEmail = form.userEmail;
      const res = await fetch(`${import.meta.env.BASE_URL}api/beta-feedback/bug-reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to submit");
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: unknown) =>
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not submit" }),
  });

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold">Bug reported — thank you!</h2>
        <p className="text-muted-foreground">Our team will investigate this. Your report helps make Cotopia more reliable for everyone.</p>
        <Button variant="outline" onClick={() => {
          setSubmitted(false);
          setForm({ whatHappened: "", pageUrl: window.location.href, whatTrying: "", severity: "medium", userEmail: "" });
        }}>
          Report another bug
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Bug className="w-6 h-6 text-red-400" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Beta Feedback</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Report a Bug</h1>
        <p className="text-muted-foreground">Found something broken? Tell us what happened and we'll get it fixed.</p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="whatHappened">What went wrong? <span className="text-red-400">*</span></Label>
          <Textarea
            id="whatHappened"
            placeholder="Describe the bug clearly — what did you see, what did you expect?"
            value={form.whatHappened}
            onChange={(e) => set("whatHappened")(e.target.value)}
            rows={5}
            maxLength={2000}
            required
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{form.whatHappened.length}/2000</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatTrying">What were you trying to do? <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="whatTrying"
            placeholder="Describe the steps that led to the bug"
            value={form.whatTrying}
            onChange={(e) => set("whatTrying")(e.target.value)}
            rows={3}
            maxLength={1000}
            className="resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label>How severe is this?</Label>
          <Select value={form.severity} onValueChange={set("severity")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pageUrl">Page where it happened <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            id="pageUrl"
            placeholder="URL of the page where the bug occurred"
            value={form.pageUrl}
            onChange={(e) => set("pageUrl")(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Your email <span className="text-muted-foreground">(optional — if you want a follow-up)</span></Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={form.userEmail}
            onChange={(e) => set("userEmail")(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white"
          disabled={mutation.isPending || form.whatHappened.trim().length < 10}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Bug Report
        </Button>
      </form>
    </div>
  );
}
