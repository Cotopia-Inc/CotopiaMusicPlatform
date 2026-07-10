import { useEffect, useState } from "react";
import { useGetCreatorSupportSettings, useUpdateCreatorSupportSettings, getGetCreatorSupportSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";

const THANK_YOU_MAX = 300;

export function CreatorSupportSettings() {
  const { toast } = useToast();
  const { data: settings } = useGetCreatorSupportSettings({
    query: { queryKey: getGetCreatorSupportSettingsQueryKey() },
  });

  const [supportEnabled, setSupportEnabled] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalMeLink, setPaypalMeLink] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [supportWallEnabled, setSupportWallEnabled] = useState(true);
  const [supportWallRequiresApproval, setSupportWallRequiresApproval] = useState(false);
  const initialized = useState({ done: false })[0];

  useEffect(() => {
    if (settings && !initialized.done) {
      setSupportEnabled(settings.supportEnabled);
      setPaypalEmail(settings.paypalEmail ?? "");
      setPaypalMeLink(settings.paypalMeLink ?? "");
      setThankYouMessage(settings.thankYouMessage ?? "");
      setSupportWallEnabled(settings.supportWallEnabled);
      setSupportWallRequiresApproval(settings.supportWallRequiresApproval);
      initialized.done = true;
    }
  }, [settings, initialized]);

  const mutation = useUpdateCreatorSupportSettings({
    mutation: {
      onSuccess: () => toast({ title: "Creator Support settings saved" }),
      onError: (err: any) => toast({ variant: "destructive", title: "Could not save settings", description: err?.data?.error ?? "Please try again." }),
    },
  });

  function handleSave() {
    mutation.mutate({
      data: {
        supportEnabled,
        paypalEmail: paypalEmail.trim() || null,
        paypalMeLink: paypalMeLink.trim() || null,
        thankYouMessage: thankYouMessage.trim() || null,
        supportWallEnabled,
        supportWallRequiresApproval,
      },
    });
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Heart className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Creator Support</p>
          <p className="text-xs text-muted-foreground">Let anyone send you demo tips on your content and profile — available to every role.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <p className="text-sm font-medium">Accept Support</p>
          <p className="text-xs text-muted-foreground">Show a Support button on your content and profile.</p>
        </div>
        <Switch checked={supportEnabled} onCheckedChange={setSupportEnabled} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">PayPal email <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Input
          type="email"
          value={paypalEmail}
          onChange={(e) => setPaypalEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">PayPal.me link <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Input
          type="text"
          value={paypalMeLink}
          onChange={(e) => setPaypalMeLink(e.target.value)}
          placeholder="https://paypal.me/yourname"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Thank-you message <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Textarea
          value={thankYouMessage}
          onChange={(e) => setThankYouMessage(e.target.value.slice(0, THANK_YOU_MAX))}
          placeholder="Thanks so much for supporting me!"
          rows={2}
        />
        <p className="text-xs text-muted-foreground text-right">{thankYouMessage.length}/{THANK_YOU_MAX}</p>
        <p className="text-xs text-muted-foreground">Shown to supporters right after they send a tip.</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <p className="text-sm font-medium">Support Wall</p>
          <p className="text-xs text-muted-foreground">Show public/anonymous supporter messages on your profile.</p>
        </div>
        <Switch checked={supportWallEnabled} onCheckedChange={setSupportWallEnabled} />
      </div>

      {supportWallEnabled && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Require approval</p>
            <p className="text-xs text-muted-foreground">Review public/anonymous messages before they appear on your wall.</p>
          </div>
          <Switch checked={supportWallRequiresApproval} onCheckedChange={setSupportWallRequiresApproval} />
        </div>
      )}

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-blue-300">
          <strong>Demo Mode — Beta Tip Testing:</strong> Creator Support is voluntary. This feature is currently operating in Demo Mode — no real payment has been processed. Payment details are stored for future use only; no real transactions or payouts occur, and supporters are never charged real money.
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

      <Button onClick={handleSave} disabled={mutation.isPending} variant="outline" className="w-full">
        {mutation.isPending ? "Saving…" : "Save Creator Support Settings"}
      </Button>
    </div>
  );
}
