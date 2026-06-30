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
import { Lightbulb, Send, CheckCircle2, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "music", label: "Music Streaming" },
  { value: "videos", label: "Video Streaming" },
  { value: "podcasts", label: "Podcasts" },
  { value: "profile", label: "Profile & Account" },
  { value: "upload", label: "Upload & Submission" },
  { value: "discovery", label: "Discovery & Search" },
  { value: "payments", label: "Payments & Plans" },
  { value: "community", label: "Community & Social" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "nice_to_have", label: "Nice to have" },
  { value: "important", label: "Important to me" },
  { value: "urgent", label: "I really need this" },
];

const authHeaders = () => {
  const token = localStorage.getItem("cotopia_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

export default function SuggestFeature() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    why: "",
    category: "other",
    priority: "nice_to_have",
    userEmail: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
      };
      if (form.why.trim()) body.why = form.why;
      if (form.userEmail.trim()) body.userEmail = form.userEmail;
      const res = await fetch(`${import.meta.env.BASE_URL}api/beta-feedback/feature-suggestions`, {
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
        <div className="w-16 h-16 rounded-full bg-violet-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold">Thanks for the idea!</h2>
        <p className="text-muted-foreground">We read every suggestion and use them to shape the roadmap. We appreciate you helping us build a better Cotopia.</p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ title: "", description: "", why: "", category: "other", priority: "nice_to_have", userEmail: "" }); }}>
          Submit another suggestion
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-violet-400" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Beta Feedback</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Suggest a Feature</h1>
        <p className="text-muted-foreground">Got an idea that would make Cotopia better? We'd love to hear it.</p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">What's your idea? <span className="text-red-400">*</span></Label>
          <Input
            id="title"
            placeholder="A short, clear title for your feature idea"
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Describe it in detail <span className="text-red-400">*</span></Label>
          <Textarea
            id="description"
            placeholder="What should this feature do? How would it work?"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            rows={5}
            maxLength={2000}
            required
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{form.description.length}/2000</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="why">Why would this help you? <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="why"
            placeholder="What problem does it solve for you?"
            value={form.why}
            onChange={(e) => set("why")(e.target.value)}
            rows={3}
            maxLength={1000}
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={set("category")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>How important is this?</Label>
            <Select value={form.priority} onValueChange={set("priority")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Your email <span className="text-muted-foreground">(optional — if you want a reply)</span></Label>
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
          className="w-full gap-2"
          disabled={mutation.isPending || form.title.trim().length < 3 || form.description.trim().length < 10}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Suggestion
        </Button>
      </form>
    </div>
  );
}
