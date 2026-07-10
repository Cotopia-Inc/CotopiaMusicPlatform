import { useState } from "react";
import {
  useGetCreatorSupportStatus, useCreateSupportTip, useTrackAnalyticsEvent,
  useGetPublicUser, useFollowUser, useUnfollowUser,
  SupportTipInputMessageVisibility, type SupportTipInputContentType,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, CheckCircle, Loader2, UserPlus, UserCheck, Sparkles } from "lucide-react";

export type SupportContentType = SupportTipInputContentType;

const QUICK_AMOUNTS = [1, 5, 10, 20, 50];
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

  const { data: status } = useGetCreatorSupportStatus(creatorUserId ?? 0, undefined, {
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
  const queryClient = useQueryClient();
  const trackEvent = useTrackAnalyticsEvent();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<SupportTipInputMessageVisibility>(SupportTipInputMessageVisibility.private);
  const [result, setResult] = useState<{ transactionRef: string; amount: number; thankYouMessage?: string | null } | null>(null);

  const amount = customAmount.trim() ? Number(customAmount) : selectedAmount;
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;

  const { data: status } = useGetCreatorSupportStatus(creatorUserId, undefined, {
    query: { enabled: open, queryKey: ["getCreatorSupportStatus", creatorUserId] },
  });

  // Inline follow state so a supporter can follow the creator without leaving the modal.
  const [optimisticFollowed, setOptimisticFollowed] = useState<boolean | null>(null);
  const { data: publicUser } = useGetPublicUser(creatorUserId, {
    query: { enabled: open, queryKey: ["getPublicUser", creatorUserId] },
  });
  const isFollowed = optimisticFollowed ?? publicUser?.isFollowed ?? false;
  const followMutation = useFollowUser({
    mutation: {
      onMutate: () => setOptimisticFollowed(true),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getPublicUser", creatorUserId] }),
      onError: () => { setOptimisticFollowed(null); toast({ variant: "destructive", title: "Could not follow" }); },
    },
  });
  const unfollowMutation = useUnfollowUser({
    mutation: {
      onMutate: () => setOptimisticFollowed(false),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getPublicUser", creatorUserId] }),
      onError: () => { setOptimisticFollowed(null); toast({ variant: "destructive", title: "Could not unfollow" }); },
    },
  });

  const mutation = useCreateSupportTip({
    mutation: {
      onSuccess: (data) => {
        setResult({ transactionRef: data.transactionRef, amount: data.amount, thankYouMessage: status?.thankYouMessage });
        queryClient.invalidateQueries({ queryKey: ["getCreatorSupportStatus", creatorUserId] });
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
    setVisibility(SupportTipInputMessageVisibility.private);
    setResult(null);
    setOptimisticFollowed(null);
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
        messageVisibility: message.trim() ? visibility : SupportTipInputMessageVisibility.private,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90svh]" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <div className="space-y-5 py-2 text-center overflow-y-auto">
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
            {result.thankYouMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-left">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">{result.thankYouMessage}</p>
              </div>
            )}
            <Button
              variant={isFollowed ? "secondary" : "default"}
              className="w-full gap-2"
              disabled={followMutation.isPending || unfollowMutation.isPending}
              onClick={() => isFollowed ? unfollowMutation.mutate({ id: creatorUserId }) : followMutation.mutate({ id: creatorUserId })}
            >
              {isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowed ? `Following ${creatorName}` : `Follow ${creatorName}`}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">💙 Support This Creator</DialogTitle>
              <DialogDescription>
                Send a one-time demo tip to {creatorName} to show your appreciation. This is a simulation — no real money is charged.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Supporting</span>
                <Button
                  variant={isFollowed ? "secondary" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                  onClick={() => isFollowed ? unfollowMutation.mutate({ id: creatorUserId }) : followMutation.mutate({ id: creatorUserId })}
                >
                  {isFollowed ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {isFollowed ? "Following" : "Follow"}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Choose an amount</label>
                <div className="grid grid-cols-5 gap-2">
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

              {message.trim() && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Who can see this message?</label>
                  <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as SupportTipInputMessageVisibility)} className="gap-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={SupportTipInputMessageVisibility.private} id="vis-private" />
                      <Label htmlFor="vis-private" className="font-normal cursor-pointer">Private — only {creatorName} sees it</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={SupportTipInputMessageVisibility.public} id="vis-public" />
                      <Label htmlFor="vis-public" className="font-normal cursor-pointer">Public — shown on the support wall with your name</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={SupportTipInputMessageVisibility.anonymous} id="vis-anonymous" />
                      <Label htmlFor="vis-anonymous" className="font-normal cursor-pointer">Anonymous — shown on the support wall without your name</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300">
                  <strong>Demo Mode:</strong> Creator Support is voluntary. This feature is currently operating in Demo Mode — no real payment has been processed and no funds are transferred to {creatorName}. Amounts and messages you choose to make public may be shown on the creator's support wall.
                </p>
              </div>
              {/*
                FUTURE LIVE-MODE DISCLOSURE (prepared, not yet activated — do not enable until real payment
                processing is wired up). When live mode ships, replace the Demo Mode notice above with this:

                "Creator support payments go directly to creators through their selected payment provider.
                Everyday Radio does not hold or manage creator tip funds. Creators are responsible for their
                payment accounts, taxes, refunds, chargebacks, and compliance obligations. Support does not
                purchase ownership, rights, royalties, access, or control over creator content."
              */}
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
