import { useEffect, useState } from "react";
import { useGetCreatorSupportSettings, useUpdateCreatorSupportSettings, getGetCreatorSupportSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";

export function CreatorSupportSettings() {
  const { toast } = useToast();
  const { data: settings } = useGetCreatorSupportSettings({
    query: { queryKey: getGetCreatorSupportSettingsQueryKey() },
  });

  const [supportEnabled, setSupportEnabled] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalMeLink, setPaypalMeLink] = useState("");
  const initialized = useState({ done: false })[0];

  useEffect(() => {
    if (settings && !initialized.done) {
      setSupportEnabled(settings.supportEnabled);
      setPaypalEmail(settings.paypalEmail ?? "");
      setPaypalMeLink(settings.paypalMeLink ?? "");
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
          <p className="text-xs text-muted-foreground">Let fans send you demo tips on your songs, videos, and profile.</p>
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

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-blue-300">
          <strong>Demo Mode:</strong> Creator Support is currently a simulated feature. Payment details are stored for future use only — no real transactions or payouts occur, and fans are never charged.
        </p>
      </div>

      <Button onClick={handleSave} disabled={mutation.isPending} variant="outline" className="w-full">
        {mutation.isPending ? "Saving…" : "Save Creator Support Settings"}
      </Button>
    </div>
  );
}
