import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, User, Music, Video, FileText, AlertOctagon, Loader2 } from "lucide-react";

export interface StrikeTarget {
  userId: number;
  uploaderName: string;
  uploaderEmail?: string;
  contentType?: "song" | "video" | "submission" | "comment" | "chat_message" | "company_post";
  contentId?: number;
  contentTitle?: string;
  dmcaClaimId?: number;
}

interface CopyrightStrikeModalProps {
  target: StrikeTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  song: Music,
  video: Video,
  submission: FileText,
  comment: AlertOctagon,
  chat_message: AlertOctagon,
  company_post: FileText,
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  song: "Song",
  video: "Video",
  submission: "Submission",
  comment: "Comment",
  chat_message: "Chat Message",
  company_post: "Company Post",
};

const STRIKE_REASONS = [
  "Copyright infringement — unauthorized reproduction",
  "Copyright infringement — sampling without clearance",
  "Plagiarism — copied from another artist",
  "Trademark violation",
  "DMCA takedown notice received",
  "Content duplicated from DMCA claim",
  "Other",
];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

export function CopyrightStrikeModal({ target, onClose, onSuccess }: CopyrightStrikeModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  const finalReason = reason === "Other" ? customReason : reason;
  const canSubmit = !!finalReason.trim() && !isPending;

  async function handleSubmit() {
    if (!target || !canSubmit) return;
    setIsPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/strikes`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: target.userId,
          contentType: target.contentType,
          contentId: target.contentId,
          contentTitle: target.contentTitle,
          strikeReason: finalReason,
          internalNotes: internalNotes || undefined,
          dmcaClaimId: target.dmcaClaimId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      const { activeStrikeCount } = await res.json();

      let description = `${target.uploaderName} now has ${activeStrikeCount} active strike${activeStrikeCount !== 1 ? "s" : ""}.`;
      if (activeStrikeCount >= 3) description += " ⚠️ Consider suspending this user.";
      else if (activeStrikeCount >= 2) description += " Second strike — user will receive a warning.";

      toast({
        title: "Copyright strike issued",
        description,
        variant: activeStrikeCount >= 3 ? "destructive" : "default",
      });

      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Could not issue strike",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsPending(false);
    }
  }

  function handleClose() {
    setReason(""); setCustomReason(""); setInternalNotes("");
    onClose();
  }

  if (!target) return null;

  const ContentIcon = (target.contentType ? CONTENT_TYPE_ICONS[target.contentType] : undefined) ?? FileText;

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
            Issue Copyright Strike
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            This action is logged in the audit trail and may trigger account warnings or suspension.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">User</p>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold truncate">{target.uploaderName}</span>
              </div>
              {target.uploaderEmail && <p className="text-xs text-muted-foreground truncate">{target.uploaderEmail}</p>}
            </div>
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Content</p>
              <div className="flex items-center gap-1.5">
                <ContentIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <Badge variant="outline" className="text-[9px] uppercase">{target.contentType ? (CONTENT_TYPE_LABELS[target.contentType] ?? target.contentType) : "Content"}</Badge>
              </div>
              <p className="text-xs text-foreground font-medium truncate">{target.contentTitle || `#${target.contentId}`}</p>
            </div>
          </div>

          {/* Reason quick picks */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Strike Reason <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {STRIKE_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    reason === r
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-secondary/50 border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {reason === "Other" && (
            <div className="space-y-1.5">
              <label htmlFor="strike-custom-reason" className="text-xs text-muted-foreground">Custom reason <span className="text-red-400">*</span></label>
              <Input
                id="strike-custom-reason"
                placeholder="Describe the infringement…"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="bg-secondary/50 border-secondary text-sm"
              />
            </div>
          )}

          {/* Internal notes */}
          <div className="space-y-1.5">
            <label htmlFor="strike-internal-notes" className="text-xs text-muted-foreground">Internal notes <span className="text-muted-foreground/50">(optional, not shown to user)</span></label>
            <Textarea
              id="strike-internal-notes"
              placeholder="Add any internal context or reference…"
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              rows={2}
              className="bg-secondary/50 border-secondary text-sm resize-none"
            />
          </div>

          {/* Warning */}
          {finalReason && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                Issuing 2+ strikes will send a warning email. At 3 strikes, suspension will be suggested. All strikes are logged and auditable.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-1.5"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Issue Strike
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
