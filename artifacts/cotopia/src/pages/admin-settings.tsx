import { useGetAppSettings, getGetAppSettingsQueryKey, useUpdateAppSettings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminSettings() {
  const { data: settings, isLoading } = useGetAppSettings({
    query: { queryKey: getGetAppSettingsQueryKey() }
  });

  const updateMutation = useUpdateAppSettings();
  const { toast } = useToast();

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
              <Label>Logo URL</Label>
              <Input 
                value={formData.logoUrl}
                onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
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
