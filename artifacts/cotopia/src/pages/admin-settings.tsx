import { useGetAppSettings, getGetAppSettingsQueryKey, useUpdateAppSettings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Brain, Check, X } from "lucide-react";
import { useUpload } from "@/lib/useUpload";

const DEFAULT_AI = {
  showHumanBadge: true,
  showAiBadge: true,
  showHybridBadge: true,
  showFullyAiBadge: true,
  showTitleIcons: true,
  showCoverOverlays: true,
  allowCreatorSelfTagging: true,
  enableAiReview: false,
  autoRejectFullyAi: false,
  autoRejectDetectionThreshold: 95,
  aiLowThreshold: 30,
  aiHighThreshold: 70,
  aiCriticalThreshold: 90,
};

type AiSettings = typeof DEFAULT_AI;
type SaveStatus = "idle" | "pending" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "pending") return (
    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Loader2 className="w-3 h-3 animate-spin" /> Saving…
    </span>
  );
  if (status === "saved") return (
    <span className="text-xs text-green-400 flex items-center gap-1.5">
      <Check className="w-3 h-3" /> Saved
    </span>
  );
  return (
    <span className="text-xs text-destructive flex items-center gap-1.5">
      <X className="w-3 h-3" /> Failed to save
    </span>
  );
}

export default function AdminSettings() {
  const { data: settings, isLoading } = useGetAppSettings({
    query: { queryKey: getGetAppSettingsQueryKey() }
  });

  const updateMutation = useUpdateAppSettings();
  const { toast } = useToast();

  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI);
  const [aiLoading, setAiLoading] = useState(false);
  const [formSaveStatus, setFormSaveStatus] = useState<SaveStatus>("idle");
  const [aiSaveStatus, setAiSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    const token = localStorage.getItem("cotopia_token");
    setAiLoading(true);
    fetch(`${import.meta.env.BASE_URL}api/admin/ai-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: Partial<AiSettings>) => {
        setAiSettings(prev => ({ ...prev, ...data }));
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, []);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFilename, setLogoFilename] = useState("");

  const { uploadFile: uploadLogo, isUploading: isUploadingLogo, progress: logoProgress } = useUpload({
    onSuccess: (res) => {
      setFormData((prev) => ({ ...prev, logoUrl: `/api/storage${res.objectPath}` }));
    },
  });

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFilename(file.name);
    await uploadLogo(file);
  };

  const [formData, setFormData] = useState({
    appName: "",
    logoUrl: "",
    primaryColor: "#7c3aed",
    singleSongFee: 9.99,
    batchSongFee: 19.99,
    premiumSongFee: 49.99,
    singleVideoFee: 14.99,
    batchVideoFee: 29.99,
    premiumVideoFee: 79.99,
    maintenanceMode: false,
    requireEmailVerification: true,
    featureRotation: true,
    autoEscalationEnabled: true,
    strikesUntilSuspension: 3,
    autoSuspensionDays: 7,
    suspensionsUntilBanReview: 3,
    showTopRated: true,
    topRatedMinRatings: 1,
  });

  useEffect(() => {
    if (!settings) return;
    setFormData({
      appName: settings.appName || "",
      logoUrl: settings.logoUrl || "",
      primaryColor: settings.primaryColor || "#7c3aed",
      singleSongFee: settings.singleSongFee ?? 9.99,
      batchSongFee: settings.batchSongFee ?? 19.99,
      premiumSongFee: settings.premiumSongFee ?? 49.99,
      singleVideoFee: settings.singleVideoFee ?? 14.99,
      batchVideoFee: settings.batchVideoFee ?? 29.99,
      premiumVideoFee: settings.premiumVideoFee ?? 79.99,
      maintenanceMode: settings.maintenanceMode || false,
      requireEmailVerification: settings.requireEmailVerification ?? true,
      featureRotation: settings.featureRotation ?? true,
      autoEscalationEnabled: settings.autoEscalationEnabled ?? true,
      strikesUntilSuspension: settings.strikesUntilSuspension ?? 3,
      autoSuspensionDays: settings.autoSuspensionDays ?? 7,
      suspensionsUntilBanReview: settings.suspensionsUntilBanReview ?? 3,
      showTopRated: settings.showTopRated ?? true,
      topRatedMinRatings: settings.topRatedMinRatings ?? 1,
    });
  }, [settings]);

  const handleSave = async () => {
    setFormSaveStatus("pending");
    try {
      await updateMutation.mutateAsync({ data: formData });
      setFormSaveStatus("saved");
      setTimeout(() => setFormSaveStatus("idle"), 3000);
    } catch (error) {
      setFormSaveStatus("error");
      const err = error as { data?: { error?: string }; message?: string };
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: err?.data?.error || err?.message || "Something went wrong",
      });
    }
  };

  const saveAiSettings = async () => {
    setAiSaveStatus("pending");
    try {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/ai-settings`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(aiSettings),
      });
      if (!res.ok) throw new Error("Failed");
      setAiSaveStatus("saved");
      setTimeout(() => setAiSaveStatus("idle"), 3000);
    } catch {
      setAiSaveStatus("error");
      toast({ variant: "destructive", title: "Failed to save AI settings" });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-muted-foreground">Configure global application settings. All changes save automatically.</p>
      </div>

      <div className="bg-card p-4 md:p-8 rounded-xl border border-border shadow-lg space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-border pb-2">Branding</h3>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input 
                value={formData.appName}
                onChange={(e) => setFormData({...formData, appName: e.target.value})}
                className="bg-secondary/50 border-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div
                onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all group ${isUploadingLogo ? "cursor-wait opacity-70" : "cursor-pointer"}`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isUploadingLogo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  {isUploadingLogo ? (
                    <div>
                      <p className="text-sm font-medium truncate">{logoFilename}</p>
                      <p className="text-xs text-primary mt-0.5">Uploading… {logoProgress}%</p>
                    </div>
                  ) : logoFilename && formData.logoUrl ? (
                    <div>
                      <p className="text-sm font-medium truncate">{logoFilename}</p>
                      <p className="text-xs text-green-400 mt-0.5">Uploaded ✓</p>
                    </div>
                  ) : formData.logoUrl ? (
                    <div>
                      <p className="text-sm font-medium">Current logo set</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{formData.logoUrl}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">Click to upload logo from device</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PNG, SVG, or WebP recommended</p>
                    </div>
                  )}
                </div>
                {formData.logoUrl && !isUploadingLogo && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFormData((p) => ({ ...p, logoUrl: "" })); setLogoFilename(""); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                    className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" disabled={isUploadingLogo} />
            </div>

            {/* ── Color picker ── */}
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(formData.primaryColor) ? formData.primaryColor : "#7c3aed"}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="sr-only"
                    id="primaryColorPicker"
                  />
                  <label
                    htmlFor="primaryColorPicker"
                    className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-border cursor-pointer hover:border-primary/50 transition-colors shadow-sm overflow-hidden"
                    title="Pick a color"
                  >
                    <span
                      className="w-full h-full block"
                      style={{ backgroundColor: /^#[0-9a-fA-F]{3,8}$/.test(formData.primaryColor) ? formData.primaryColor : "#7c3aed" }}
                    />
                  </label>
                </div>
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  placeholder="#7c3aed"
                  maxLength={9}
                  className="bg-secondary/50 border-secondary font-mono flex-1"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">Click the swatch to open the color picker, or type a hex value directly.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-border pb-2">Financials</h3>
          <p className="text-sm text-muted-foreground">Submission fees per plan tier. Changes apply to all new payment initiations immediately.</p>

          <div className="space-y-4">
            <div className="p-4 bg-secondary/20 rounded-lg border border-border space-y-3">
              <p className="text-sm font-semibold">Single Submission</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Song ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.singleSongFee}
                    onChange={(e) => setFormData({ ...formData, singleSongFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Video ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.singleVideoFee}
                    onChange={(e) => setFormData({ ...formData, singleVideoFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-secondary/20 rounded-lg border border-border space-y-3">
              <p className="text-sm font-semibold">Batch Submission</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Song ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.batchSongFee}
                    onChange={(e) => setFormData({ ...formData, batchSongFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Video ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.batchVideoFee}
                    onChange={(e) => setFormData({ ...formData, batchVideoFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-secondary/20 rounded-lg border border-border space-y-3">
              <p className="text-sm font-semibold">Featured Placement</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Song ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.premiumSongFee}
                    onChange={(e) => setFormData({ ...formData, premiumSongFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Video ($)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={formData.premiumVideoFee}
                    onChange={(e) => setFormData({ ...formData, premiumVideoFee: Number(e.target.value) })}
                    className="bg-secondary/50 border-secondary"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-border pb-2">System</h3>
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-bold text-base text-destructive">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">Display maintenance screen to all non-admin users.</p>
            </div>
            <Switch 
              checked={formData.maintenanceMode}
              onCheckedChange={(checked) => setFormData({...formData, maintenanceMode: checked})}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-bold text-base">Email Verification</Label>
              <p className="text-sm text-muted-foreground">Require new users to verify their email address after registering. When off, accounts are activated instantly.</p>
            </div>
            <Switch
              checked={formData.requireEmailVerification}
              onCheckedChange={(checked) => setFormData({...formData, requireEmailVerification: checked})}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-bold text-base">Featured Rotation</Label>
              <p className="text-sm text-muted-foreground">Automatically rotate featured songs and videos across the home and discover pages over time. When off, the most recent featured items stay fixed.</p>
            </div>
            <Switch
              checked={formData.featureRotation}
              onCheckedChange={(checked) => setFormData({...formData, featureRotation: checked})}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-bold text-base">Top Rated Board</Label>
              <p className="text-sm text-muted-foreground">Show the Top Rated section on the Discover page, ranking songs by average creator rating. When off, the section is hidden from all users.</p>
            </div>
            <Switch
              checked={formData.showTopRated}
              onCheckedChange={(checked) => setFormData({...formData, showTopRated: checked})}
            />
          </div>

          <div className={`space-y-2 ${formData.showTopRated ? "" : "opacity-50 pointer-events-none"}`}>
            <Label>Minimum Ratings Required</Label>
            <Input
              type="number"
              min={1}
              value={formData.topRatedMinRatings}
              onChange={(e) => setFormData({...formData, topRatedMinRatings: Math.max(1, Number(e.target.value))})}
              className="bg-secondary/50 border-secondary max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">A song must have at least this many ratings to appear in the Top Rated board. Raise this to filter out songs with only one or two votes.</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-border pb-2">Enforcement &amp; Auto-Escalation</h3>

          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-bold text-base">Auto-Escalation</Label>
              <p className="text-sm text-muted-foreground">Automatically suspend users who accumulate enough active strikes, and flag repeat offenders for ban review. When off, all enforcement stays manual.</p>
            </div>
            <Switch
              checked={formData.autoEscalationEnabled}
              onCheckedChange={(checked) => setFormData({...formData, autoEscalationEnabled: checked})}
            />
          </div>

          <div className={`grid sm:grid-cols-3 gap-4 ${formData.autoEscalationEnabled ? "" : "opacity-50 pointer-events-none"}`}>
            <div className="space-y-2">
              <Label>Strikes → Suspension</Label>
              <Input
                type="number"
                min={1}
                value={formData.strikesUntilSuspension}
                onChange={(e) => setFormData({...formData, strikesUntilSuspension: Math.max(1, Number(e.target.value))})}
                className="bg-secondary/50 border-secondary"
              />
              <p className="text-xs text-muted-foreground">Active strikes that trigger an automatic suspension.</p>
            </div>
            <div className="space-y-2">
              <Label>Suspension Length (days)</Label>
              <Input
                type="number"
                min={1}
                value={formData.autoSuspensionDays}
                onChange={(e) => setFormData({...formData, autoSuspensionDays: Math.max(1, Number(e.target.value))})}
                className="bg-secondary/50 border-secondary"
              />
              <p className="text-xs text-muted-foreground">Duration of each automatic suspension.</p>
            </div>
            <div className="space-y-2">
              <Label>Suspensions → Ban Review</Label>
              <Input
                type="number"
                min={1}
                value={formData.suspensionsUntilBanReview}
                onChange={(e) => setFormData({...formData, suspensionsUntilBanReview: Math.max(1, Number(e.target.value))})}
                className="bg-secondary/50 border-secondary"
              />
              <p className="text-xs text-muted-foreground">Total suspensions that flag a user for ban review.</p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <SaveIndicator status={formSaveStatus} />
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg">
            {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* ── AI Content Origin Settings ── */}
      <div className="bg-card p-4 md:p-8 rounded-xl border border-border shadow-lg space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">AI Content Origin Policy</h3>
            <p className="text-sm text-muted-foreground">Control how AI authorship badges are shown and how AI detection is enforced.</p>
          </div>
          <SaveIndicator status={aiSaveStatus} />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Badge Visibility</p>
          {([
            { key: "showHumanBadge", label: "Show Human Created badge", desc: "Display the 'Human' badge on qualifying tracks and videos." },
            { key: "showAiBadge", label: "Show AI Assisted badge", desc: "Display the 'AI Assisted' badge." },
            { key: "showHybridBadge", label: "Show Human + AI badge", desc: "Display the 'Human + AI' hybrid badge." },
            { key: "showFullyAiBadge", label: "Show Fully AI badge", desc: "Display the 'Fully AI' badge (for any approved exceptions)." },
            { key: "showTitleIcons", label: "Show icons in content titles", desc: "Show small AI origin icons next to track/video titles in listings." },
            { key: "showCoverOverlays", label: "Show cover art overlay badges", desc: "Overlay AI origin badge on artwork thumbnails." },
          ] as { key: keyof AiSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="font-medium text-sm">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={Boolean(aiSettings[key])}
                onCheckedChange={(v) => setAiSettings(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creator & Detection Policy</p>
          {([
            { key: "allowCreatorSelfTagging", label: "Allow creator self-tagging", desc: "Creators can declare their content's AI origin at submission time." },
            { key: "enableAiReview", label: "Enable AI detection scans", desc: "Trigger Hive Moderation scans on submitted content for automated AI likelihood scoring." },
            { key: "autoRejectFullyAi", label: "Auto-reject fully AI submissions", desc: "Automatically reject submissions where the creator declares fully AI-generated content." },
          ] as { key: keyof AiSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="font-medium text-sm">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={Boolean(aiSettings[key])}
                onCheckedChange={(v) => setAiSettings(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detection Thresholds (%)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {([
              { key: "aiLowThreshold", label: "Low risk cutoff" },
              { key: "aiHighThreshold", label: "High risk cutoff" },
              { key: "aiCriticalThreshold", label: "Critical risk cutoff" },
              { key: "autoRejectDetectionThreshold", label: "Auto-reject at" },
            ] as { key: keyof AiSettings; label: string }[]).map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type="number" min={0} max={100} step={1}
                  value={Number(aiSettings[key])}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, [key]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="bg-secondary/50 border-secondary"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Scores below Low are shown as Low risk. Between Low and High is Medium. Between High and Critical is High. Above Critical is flagged as Critical.</p>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <SaveIndicator status={aiSaveStatus} />
          <Button onClick={saveAiSettings} disabled={aiSaveStatus === "pending"} size="lg">
            {aiSaveStatus === "pending" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save AI Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
