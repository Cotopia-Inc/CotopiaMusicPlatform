import { useState } from "react";
import {
  useGetCreatorSupportStatus, useCreateSupportTip, useTrackAnalyticsEvent,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Heart, CheckCircle, Loader2 } from "lucide-react";

export type SupportContentType = "song" | "video" | "artist" | "label";

const QUICK_AMOUNTS = [1, 5, 10, 25];
const MESSAGE_MAX = 500;

interface SupportButtonProps {
  /** The user id of the creator receiving support (resolved server-side, but needed client-side to check status/self). */
  creatorUserId: number | null | undefined;
  creatorName: string;
  contentType: SupportContentType;
  contentId: number;
  variant?: "button" | "outline";
  size?: "sm" | "default";
  className?: string;
}

export function SupportButton({ creatorUserId, creatorName, contentType, contentId, variant = "outline", size = "sm", className }: SupportButtonProps) {
  const { user } = useAuth();
  const trackEvent = useTrackAnalyticsEvent();
  const [open, setOpen] = useState(false);

  const canSupport = !!user && !!creatorUserId && user.id !== creatorUserId;

  const { data: status } = useGetCreatorSupportStatus(creatorUserId ?? 0, {
    query: { enabled: canSupport, queryKey: ["getCreatorSupportStatus", creatorUserId] },
  });

  if (!canSupport || !status?.supportEnabled) return null;

  function handleOpen() {
    trackEvent.mutate({ data: { eventType: "engagement", eventName: "support_button_click", contentType: "user" as const, contentId: creatorUserId! } });
    setOpen(true);
  }

  return (
    <>
      <Button
        variant={variant === "button" ? "default" : "outline"}
        size={size}
        className={`rounded-full gap-1.5 ${className ?? ""}`}
        onClick={handleOpen}
      >
        <Heart className="w-4 h-4" />
        Support
      </Button>
      <SupportModal
        open={open}
        onOpenChange={setOpen}
        creatorUserId={creatorUserId!}
        creatorName={creatorName}
        contentType={contentType}
        contentId={contentId}
      />
    </>
  );
}

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorUserId: number;
  creatorName: string;
  contentType: SupportContentType;
  contentId: number;
}

export function SupportModal({ open, onOpenChange, creatorUserId, creatorName, contentType, contentId }: SupportModalProps) {
  const { toast } = useToast();
  const trackEvent = useTrackAnalyticsEvent();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ transactionRef: string; amount: number } | null>(null);

  const amount = customAmount.trim() ? Number(customAmount) : selectedAmount;
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;

  const mutation = useCreateSupportTip({
    mutation: {
      onSuccess: (data) => {
        setResult({ transactionRef: data.transactionRef, amount: data.amount });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Could not send support", description: err?.data?.error ?? "Please try again." });
      },
    },
  });

  function reset() {
    setSelectedAmount(5);
    setCustomAmount("");
    setMessage("");
    setResult(null);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!isValidAmount) return;
    trackEvent.mutate({ data: { eventType: "engagement", eventName: "support_tip_attempt", contentType: "user" as const, contentId: creatorUserId } });
    mutation.mutate({
      data: {
        contentType,
        contentId,
        amount,
        message: message.trim() || undefined,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <div className="space-y-5 py-2 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">Support sent!</h3>
              <p className="text-sm text-muted-foreground">
                Your ${result.amount.toFixed(2)} demo tip to {creatorName} went through.
              </p>
              <p className="text-xs font-mono text-muted-foreground">{result.transactionRef}</p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-primary" /> Support {creatorName}</DialogTitle>
              <DialogDescription>
                Send a one-time demo tip to show your appreciation. This is a simulation — no real money is charged.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Choose an amount</label>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant={!customAmount && selectedAmount === amt ? "default" : "outline"}
                      onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Custom:</span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                  placeholder={`Say something nice to ${creatorName}...`}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{message.length}/{MESSAGE_MAX}</p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300">
                  <strong>Demo Mode:</strong> Creator Support is a simulated tipping feature. No real payment is processed and no funds are transferred. Support amounts and messages are visible to the creator and may be shown on your activity.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button disabled={!isValidAmount || mutation.isPending} onClick={handleSubmit} className="gap-2">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <>Send ${isValidAmount ? amount!.toFixed(2) : "0.00"} Support</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
