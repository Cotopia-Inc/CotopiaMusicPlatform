import { useGetAppSettings, getGetAppSettingsQueryKey, useUpdateAppSettings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";

export default function AdminSettings() {
  const { data: settings, isLoading } = useGetAppSettings({
    query: { queryKey: getGetAppSettingsQueryKey() }
  });

  const updateMutation = useUpdateAppSettings();
  const { toast } = useToast();
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
    primaryColor: "",
    songSubmissionFee: 0,
    videoSubmissionFee: 0,
    maintenanceMode: false
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        appName: settings.appName || "",
        logoUrl: settings.logoUrl || "",
        primaryColor: settings.primaryColor || "",
        songSubmissionFee: settings.songSubmissionFee || 0,
        videoSubmissionFee: settings.videoSubmissionFee || 0,
        maintenanceMode: settings.maintenanceMode || false
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
      }
    });
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
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-muted-foreground">Configure global application settings and parameters.</p>
      </div>

      <div className="bg-card p-8 rounded-xl border border-border shadow-lg space-y-8">
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
              <p className="text-xs text-muted-foreground">Or paste a URL directly:</p>
              <Input
                value={formData.logoUrl.startsWith("/api/storage") ? "" : formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://... (direct image URL)"
                className="bg-secondary/50 border-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Color (Hex)</Label>
              <Input 
                value={formData.primaryColor}
                onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                className="bg-secondary/50 border-secondary"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-border pb-2">Financials</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Song Submission Fee ($)</Label>
              <Input 
                type="number"
                value={formData.songSubmissionFee}
                onChange={(e) => setFormData({...formData, songSubmissionFee: Number(e.target.value)})}
                className="bg-secondary/50 border-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label>Video Submission Fee ($)</Label>
              <Input 
                type="number"
                value={formData.videoSubmissionFee}
                onChange={(e) => setFormData({...formData, videoSubmissionFee: Number(e.target.value)})}
                className="bg-secondary/50 border-secondary"
              />
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
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg">
            {updateMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
