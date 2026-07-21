import { useState } from "react";
import { useCreateReport, type ReportInput } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";

export type ReportTargetType =
  | "song" | "video" | "profile" | "comment" | "chat_message" | "private_message";

const REASONS: { value: string; label: string }[] = [
  { value: "copyright", label: "Copyright" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "fake_profile", label: "Fake Profile" },
  { value: "illegal_content", label: "Illegal Content" },
  { value: "other", label: "Other" },
];

const TARGET_LABELS: Record<ReportTargetType, string> = {
  song: "song",
  video: "video",
  profile: "profile",
  comment: "comment",
  chat_message: "chat message",
  private_message: "private message",
};

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: number;
  /** Optional custom trigger. When omitted, a default flag button is rendered. */
  trigger?: React.ReactNode;
  /** Visual style for the default trigger. */
  variant?: "icon" | "button" | "menuitem";
  className?: string;
  /** Controlled open state. When provided, no internal trigger is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReportModal({ targetType, targetId, trigger, variant = "icon", className, open: controlledOpen, onOpenChange }: ReportModalProps) {
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setUncontrolledOpen(v);
  };
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const mutation = useCreateReport({
    mutation: {
      onSuccess: () => {
        toast({ title: "Report submitted", description: "Thanks — our moderation team will review it." });
        setOpen(false);
        setReason("");
        setDetails("");
      },
      onError: (err) => toast({ variant: "destructive", title: "Could not submit report", description: err instanceof Error ? err.message : "Please try again" }),
    },
  });

  const submitReport = () => {
    mutation.mutate({
      data: {
        targetType: targetType as ReportInput["targetType"],
        targetId,
        reason: reason as ReportInput["reason"],
        details: details.trim() || undefined,
      },
    });
  };

  const defaultTrigger =
    variant === "button" ? (
      <Button variant="outline" size="sm" className={`gap-1.5 ${className ?? ""}`}>
        <Flag className="w-4 h-4" /> Report
      </Button>
    ) : variant === "menuitem" ? (
      <button className={`flex items-center gap-2 w-full text-left ${className ?? ""}`}>
        <Flag className="w-4 h-4" /> Report
      </button>
    ) : (
      <button
        title={`Report ${TARGET_LABELS[targetType]}`}
        aria-label={`Report ${TARGET_LABELS[targetType]}`}
        className={`text-muted-foreground hover:text-destructive transition-colors ${className ?? ""}`}
      >
        <Flag className="w-4 h-4" />
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Report {TARGET_LABELS[targetType]}</DialogTitle>
          <DialogDescription>
            Tell us what's wrong. Reports are confidential and reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="report-details" className="text-sm font-medium">Details <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any context that will help us review this report."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!reason || mutation.isPending}
            onClick={submitReport}
          >
            {mutation.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
