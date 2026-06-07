import { useGetMe, getGetMeQueryKey, useUpdateMe } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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
  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      setDisplayName(profile.displayName || "");
      setAvatarUrl(profile.avatarUrl || "");
      initialized.current = true;
    }
  }, [profile]);

  const updateMutation = useUpdateMe();
  const { toast } = useToast();

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

        <div className="space-y-2">
          <label className="text-sm font-medium">Avatar URL</label>
          <Input 
            value={avatarUrl} 
            onChange={(e) => setAvatarUrl(e.target.value)} 
            className="bg-secondary/50 border-secondary"
          />
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
