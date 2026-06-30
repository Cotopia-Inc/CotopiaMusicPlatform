import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Star, Loader2, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";

interface ExperienceFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  trigger?: "after_upload" | "after_submit" | "first_visit" | "manual" | "general";
}

const authHeaders = () => {
  const token = localStorage.getItem("cotopia_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

export function ExperienceFeedbackModal({ open, onClose, trigger = "general" }: ExperienceFeedbackModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"rating" | "details" | "done">("rating");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    whatWorkedWell: "",
    whatWasConfusing: "",
    didAnythingBreak: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | number | boolean> = { rating, trigger };
      if (form.whatWorkedWell.trim()) body.whatWorkedWell = form.whatWorkedWell;
      if (form.whatWasConfusing.trim()) body.whatWasConfusing = form.whatWasConfusing;
      if (form.didAnythingBreak.trim()) body.didAnythingBreak = form.didAnythingBreak;
      if (wouldRecommend !== null) body.wouldRecommend = wouldRecommend;
      const res = await fetch(`${import.meta.env.BASE_URL}api/beta-feedback/experience-feedback`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to submit");
      return res.json();
    },
    onSuccess: () => setStep("done"),
    onError: (err: unknown) =>
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not submit" }),
  });

  const handleClose = () => {
    setStep("rating");
    setRating(0);
    setHovered(0);
    setWouldRecommend(null);
    setForm({ whatWorkedWell: "", whatWasConfusing: "", didAnythingBreak: "" });
    onClose();
  };

  const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        {step === "rating" && (
          <>
            <DialogHeader>
              <DialogTitle>How's your Cotopia experience?</DialogTitle>
              <DialogDescription>
                Your feedback shapes what we build next.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          star <= (hovered || rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm font-medium text-muted-foreground h-5">
                  {STAR_LABELS[hovered || rating]}
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Maybe later
                </Button>
                <Button
                  className="flex-1"
                  disabled={rating === 0}
                  onClick={() => setStep("details")}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <DialogHeader>
              <DialogTitle>Tell us a bit more</DialogTitle>
              <DialogDescription>All fields are optional — share whatever's on your mind.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What worked well?</label>
                <Textarea
                  placeholder="What did you enjoy or find easy?"
                  value={form.whatWorkedWell}
                  onChange={(e) => setForm(f => ({ ...f, whatWorkedWell: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  className="resize-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What was confusing?</label>
                <Textarea
                  placeholder="Anything that felt unclear or hard to find?"
                  value={form.whatWasConfusing}
                  onChange={(e) => setForm(f => ({ ...f, whatWasConfusing: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  className="resize-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Did anything break?</label>
                <Textarea
                  placeholder="Any errors or things that didn't work as expected?"
                  value={form.didAnythingBreak}
                  onChange={(e) => setForm(f => ({ ...f, didAnythingBreak: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  className="resize-none text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Would you recommend Cotopia?</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      wouldRecommend === true
                        ? "bg-green-500/15 border-green-500/40 text-green-400"
                        : "border-border text-muted-foreground hover:border-green-500/30"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      wouldRecommend === false
                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                        : "border-border text-muted-foreground hover:border-red-500/30"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" /> Not yet
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("rating")}>
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Feedback
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Thank you!</h3>
              <p className="text-muted-foreground text-sm mt-1">Your feedback means a lot to us.</p>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
