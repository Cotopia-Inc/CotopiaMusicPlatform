import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Scale, Save, Loader2, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface LegalSettings {
  termsVersion: string;
  privacyVersion: string;
  submissionAgreementVersion: string;
  dmcaContactEmail: string;
  copyrightAgentInfo: string;
  refundPolicyText: string;
  aiPolicyText: string;
  communityRulesText: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

export default function AdminLegal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMasterAdmin = user?.role === "master_admin";

  const { data, isLoading } = useQuery<LegalSettings>({
    queryKey: ["admin-legal-settings"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/legal-settings`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Access denied");
      return res.json();
    },
    enabled: isMasterAdmin,
  });

  const [form, setForm] = useState<LegalSettings>({
    termsVersion: "1.0",
    privacyVersion: "1.0",
    submissionAgreementVersion: "1.0",
    dmcaContactEmail: "legal@cotopia.org",
    copyrightAgentInfo: "Cotopia Legal Team, legal@cotopia.org",
    refundPolicyText: "",
    aiPolicyText: "",
    communityRulesText: "",
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = (field: keyof LegalSettings, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/legal-settings`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => toast({ title: "Legal settings saved" }),
    onError: (err) => toast({ title: "Save failed", description: String(err instanceof Error ? err.message : err), variant: "destructive" }),
  });

  if (!isMasterAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-3">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-bold">Access Restricted</h1>
        <p className="text-sm text-muted-foreground">Legal settings are only accessible to master administrators.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Scale className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Legal Settings</h1>
          <p className="text-sm text-muted-foreground">Master admin only — manage legal policy versions and contact information</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">Changes to legal settings are logged in the audit trail. Version numbers should be incremented when policy text changes materially.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Policy Versions</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tv" className="text-xs text-muted-foreground">Terms Version</Label>
            <Input id="tv" value={form.termsVersion} onChange={e => update("termsVersion", e.target.value)} className="bg-secondary/50 border-secondary" placeholder="1.0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pv" className="text-xs text-muted-foreground">Privacy Version</Label>
            <Input id="pv" value={form.privacyVersion} onChange={e => update("privacyVersion", e.target.value)} className="bg-secondary/50 border-secondary" placeholder="1.0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sav" className="text-xs text-muted-foreground">Submission Agreement Version</Label>
            <Input id="sav" value={form.submissionAgreementVersion} onChange={e => update("submissionAgreementVersion", e.target.value)} className="bg-secondary/50 border-secondary" placeholder="1.0" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">DMCA Contact</h2>
        <div className="space-y-1.5">
          <Label htmlFor="dmca-email" className="text-xs text-muted-foreground">DMCA Contact Email</Label>
          <Input id="dmca-email" type="email" value={form.dmcaContactEmail} onChange={e => update("dmcaContactEmail", e.target.value)} className="bg-secondary/50 border-secondary" placeholder="legal@cotopia.org" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent" className="text-xs text-muted-foreground">Copyright Agent Information</Label>
          <Textarea id="agent" value={form.copyrightAgentInfo} onChange={e => update("copyrightAgentInfo", e.target.value)} rows={3} className="bg-secondary/50 border-secondary resize-none text-sm" placeholder="Agent name, address, email…" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Policy Text Overrides</h2>
        <p className="text-xs text-muted-foreground">These fields override the default policy page text with custom content. Leave blank to use the default built-in policy pages.</p>
        <div className="space-y-1.5">
          <Label htmlFor="refund" className="text-xs text-muted-foreground">Refund Policy Text (override)</Label>
          <Textarea id="refund" value={form.refundPolicyText ?? ""} onChange={e => update("refundPolicyText", e.target.value)} rows={4} className="bg-secondary/50 border-secondary resize-none text-sm" placeholder="Leave blank to use the default refund policy page…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai" className="text-xs text-muted-foreground">AI Policy Text (override)</Label>
          <Textarea id="ai" value={form.aiPolicyText ?? ""} onChange={e => update("aiPolicyText", e.target.value)} rows={4} className="bg-secondary/50 border-secondary resize-none text-sm" placeholder="Leave blank to use the default AI policy page…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rules" className="text-xs text-muted-foreground">Community Rules Text (override)</Label>
          <Textarea id="rules" value={form.communityRulesText ?? ""} onChange={e => update("communityRulesText", e.target.value)} rows={4} className="bg-secondary/50 border-secondary resize-none text-sm" placeholder="Leave blank to use the default community guidelines page…" />
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 w-full sm:w-auto">
        {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Legal Settings</>}
      </Button>
    </div>
  );
}
