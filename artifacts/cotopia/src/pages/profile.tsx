import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useGetMe({
    query: {
      enabled: !!user,
      queryKey: getGetMeQueryKey()
    }
  });

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFilename, setAvatarFilename] = useState("");
  const [avatarUrlMode, setAvatarUrlMode] = useState(false);
  const initialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && !initialized.current) {
      setDisplayName(profile.displayName || "");
      setAvatarUrl(profile.avatarUrl || "");
      initialized.current = true;
    }
  }, [profile]);

  const updateMutation = useUpdateMe();
  const { toast } = useToast();

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setAvatarFilename(file.name);
    setAvatarUrl(objectUrl);
  };

  const clearAvatar = () => {
    setAvatarUrl("");
    setAvatarFilename("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    updateMutation.mutate({ data: { displayName, avatarUrl } }, {
      onSuccess: () => {
        toast({ title: "Profile updated" });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Update failed" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 mt-12">
        <Skeleton className="w-32 h-32 rounded-full mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
      </div>
    );
  }

  if (!profile) return <div>Not authenticated</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-24">
      <div className="text-center space-y-4">
        <div className="w-32 h-32 mx-auto rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">{profile.username[0].toUpperCase()}</span>
          )}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{profile.username}</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">{profile.role}</p>
      </div>

      <div className="space-y-6 bg-card p-8 rounded-xl border border-border">
        <h2 className="text-xl font-bold">Profile Settings</h2>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Display Name</label>
          <Input 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            className="bg-secondary/50 border-secondary"
          />
        </div>

        {/* Avatar upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Picture</label>

          {!avatarUrlMode ? (
            <div className="space-y-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 cursor-pointer transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Upload className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {avatarFilename ? (
                    <div>
                      <p className="text-sm font-medium text-foreground truncate">{avatarFilename}</p>
                      <p className="text-xs text-green-400 mt-0.5">Photo selected ✓</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">Click to upload from device</p>
                      <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WebP</p>
                    </div>
                  )}
                </div>
                {avatarFilename && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearAvatar(); }}
                    className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              <button
                type="button"
                onClick={() => setAvatarUrlMode(true)}
                className="text-xs text-primary hover:underline"
              >
                Or paste a URL instead
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input 
                value={avatarUrl.startsWith("blob:") ? "" : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)} 
                placeholder="https://... (direct image URL)"
                className="bg-secondary/50 border-secondary"
              />
              <button
                type="button"
                onClick={() => setAvatarUrlMode(false)}
                className="text-xs text-primary hover:underline"
              >
                ← Upload from device instead
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input 
            value={profile.email} 
            disabled 
            className="bg-secondary/20 border-secondary text-muted-foreground"
          />
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
