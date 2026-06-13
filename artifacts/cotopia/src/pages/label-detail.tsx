import { useParams, Link, useLocation } from "wouter";
import { useGetLabel, getGetLabelQueryKey, useFollowLabel, useUnfollowLabel } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Music, Play } from "lucide-react";
import { UserLink } from "@/components/user-link";
import { RoleBadges } from "@/components/role-badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LabelDetail() {
  const { id } = useParams();
  const labelId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: label, isLoading } = useGetLabel(labelId, {
    query: { enabled: !!labelId, queryKey: getGetLabelQueryKey(labelId) }
  });

  const followMutation = useFollowLabel();
  const unfollowMutation = useUnfollowLabel();

  const handleFollowToggle = () => {
    if (!label) return;
    const mutation = label.isFollowed ? unfollowMutation : followMutation;
    mutation.mutate({ id: labelId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLabelQueryKey(labelId) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24">
        <Skeleton className="w-full h-48 rounded-xl" />
        <div className="flex gap-8 px-8 -mt-12 relative z-10">
          <Skeleton className="w-40 h-40 rounded-xl border-4 border-background" />
          <div className="pt-16 space-y-4">
            <Skeleton className="h-10 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!label) return <div className="p-8 text-center text-muted-foreground">Label not found</div>;

  return (
    <div className="space-y-12 pb-24">
      {/* Banner / Profile Video */}
      <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden bg-secondary border border-border relative">
        {(label as any).profileVideoUrl ? (
          <video
            src={(label as any).profileVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-80"
          />
        ) : label.bannerUrl ? (
          <img src={label.bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-50" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-8 px-8 -mt-20 relative z-10 items-end">
        <div className="w-40 h-40 rounded-xl overflow-hidden bg-card border-4 border-background shadow-2xl flex items-center justify-center p-4">
          {label.logoUrl ? (
            <img src={label.logoUrl} alt={label.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-3xl font-bold text-muted-foreground">{label.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-2">{label.name}<RoleBadges role="label" isVerified={label.isVerified ?? false} size="md" /></h1>
            <div className="flex items-center gap-4 text-muted-foreground font-medium text-sm">
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {label.followerCount?.toLocaleString() || 0} followers</span>
              <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {label.artistCount || 0} artists</span>
            </div>
          </div>
          <div className="flex gap-3">
            {user && (
              <Button 
                variant={label.isFollowed ? "outline" : "default"} 
                size="lg" 
                className="rounded-full px-6"
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                {label.isFollowed ? "Following Label" : "Follow Label"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8">
        <Tabs defaultValue="releases">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
            <TabsTrigger value="releases" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Recent Releases</TabsTrigger>
            <TabsTrigger value="artists" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">Roster</TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base">About</TabsTrigger>
          </TabsList>
          
          <TabsContent value="releases" className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {label.recentReleases && label.recentReleases.length > 0 ? (
                label.recentReleases.map((song) => (
                  <div key={song.id} className="group cursor-pointer space-y-3" onClick={() => navigate(`/songs/${song.id}`)}>
                    <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                      {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm truncate">{song.title}</h4>
                      <UserLink
                        username={song.artistName}
                        artistId={song.artistId}
                        role="artist"
                        isVerified={(song as any).artistIsVerified ?? false}
                        className="text-xs text-muted-foreground"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-muted-foreground py-8">No releases available.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="artists" className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
              {label.artists && label.artists.length > 0 ? (
                label.artists.map((artist) => (
                  <Link key={artist.id} href={`/artists/${artist.id}`}>
                    <div className="group cursor-pointer space-y-4 text-center">
                      <div className="w-full aspect-square relative overflow-hidden rounded-full bg-secondary border border-border">
                        {artist.avatarUrl ? (
                          <img src={artist.avatarUrl} alt={artist.stageName} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                            {artist.stageName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm flex items-center justify-center gap-1 flex-wrap"><span className="truncate">{artist.stageName}</span><RoleBadges role="artist" isVerified={(artist as any).isVerified} size="sm" /></h4>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="col-span-full text-muted-foreground py-8">No artists on roster.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="about" className="pt-6">
            <div className="max-w-3xl">
              <h3 className="text-xl font-bold mb-4">About Label</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {label.bio || "No information provided."}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
