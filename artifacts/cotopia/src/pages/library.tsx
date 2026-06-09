import { useState } from "react";
import { useGetFavoriteSongs, getGetFavoriteSongsQueryKey, useListPlaylists, getListPlaylistsQueryKey, useGetHistory, getGetHistoryQueryKey, useCreatePlaylist } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Music, ListMusic, Clock, Plus, BookOpen, Heart, X, BadgeCheck } from "lucide-react";
import { usePlayer } from "@/lib/player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Library() {
  const { user } = useAuth();
  const { play } = usePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { data: favoriteSongs, isLoading: loadingFavs } = useGetFavoriteSongs({
    query: { enabled: !!user, queryKey: getGetFavoriteSongsQueryKey() }
  });

  const { data: playlists, isLoading: loadingPlaylists } = useListPlaylists({
    query: { enabled: !!user, queryKey: getListPlaylistsQueryKey() }
  });

  const { data: history, isLoading: loadingHistory } = useGetHistory(
    { limit: 50 },
    { query: { enabled: !!user, queryKey: getGetHistoryQueryKey({ limit: 50 }) } }
  );

  const createPlaylistMutation = useCreatePlaylist();

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylistMutation.mutate({ data: { name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
        setShowNewPlaylist(false);
        setNewPlaylistName("");
        toast({ title: "Playlist created", description: `"${name}" is ready.` });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create playlist" }),
    });
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <BookOpen className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Your Library</h2>
        <p className="text-muted-foreground">Sign in to save songs, create playlists, and view your history.</p>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Your Library</h1>
        <Button className="gap-2" onClick={() => setShowNewPlaylist(true)}>
          <Plus className="w-4 h-4" /> New Playlist
        </Button>
      </div>

      {/* New Playlist dialog */}
      {showNewPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewPlaylist(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New Playlist</h2>
              <button onClick={() => setShowNewPlaylist(false)} className="text-muted-foreground hover:text-foreground transition-colors" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Input
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              className="bg-secondary/50 border-secondary"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowNewPlaylist(false); setNewPlaylistName(""); }}>Cancel</Button>
              <Button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}>
                {createPlaylistMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="likes" className="w-full">
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
          <TabsTrigger value="likes" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base flex gap-2">
            <Heart className="w-4 h-4" /> Liked Songs
          </TabsTrigger>
          <TabsTrigger value="playlists" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base flex gap-2">
            <ListMusic className="w-4 h-4" /> Playlists
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 text-base flex gap-2">
            <Clock className="w-4 h-4" /> Listening History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="likes" className="pt-6">
          {loadingFavs ? (
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : favoriteSongs?.length ? (
            <div className="space-y-2">
              {favoriteSongs.map((song, idx) => (
                <div
                  key={song.id}
                  className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors"
                  onClick={() => play({ id: song.id, title: song.title, artistName: song.artistName ?? "", coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration, isFavorited: true })}
                >
                  <span className="w-6 text-center text-muted-foreground text-sm group-hover:hidden">{idx + 1}</span>
                  <Play className="w-4 h-4 fill-current text-primary hidden group-hover:block ml-1 mr-1" />
                  <div className="w-12 h-12 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {song.coverUrl && <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{song.title}</div>
                    <Link href={`/artists/${song.artistId}`} onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                        {song.artistName}
                        <BadgeCheck className="w-3 h-3 text-primary/70 flex-shrink-0" />
                      </span>
                    </Link>
                  </div>
                  <div className="text-muted-foreground text-sm w-16 text-right">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>You haven't liked any songs yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="playlists" className="pt-6">
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {loadingPlaylists ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))
            ) : playlists?.length ? (
              playlists.map((playlist) => (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                  <div className="group cursor-pointer space-y-3">
                    <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border flex items-center justify-center">
                      {playlist.coverUrl ? (
                        <img src={playlist.coverUrl} alt={playlist.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <ListMusic className="w-12 h-12 text-muted-foreground opacity-50" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm truncate">{playlist.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{playlist.songCount} songs</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                <p>You haven't created any playlists yet.</p>
              </div>
            )}
           </div>
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          {loadingHistory ? (
             <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : history?.length ? (
            <div className="space-y-2">
              {history.map((item) => (
                <Link key={item.id} href={`/${item.type}s/${item.contentId}`}>
                  <div className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors">
                    <div className="w-12 h-12 rounded bg-secondary overflow-hidden flex items-center justify-center">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt={item.contentTitle} className="w-full h-full object-cover" />
                      ) : (
                        item.type === 'song' ? <Music className="w-5 h-5 text-muted-foreground" /> : <Play className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{item.contentTitle}</div>
                      <div className="text-sm text-muted-foreground">{item.artistName} • <span className="uppercase text-[10px] tracking-wider text-primary">{item.type}</span></div>
                    </div>
                    <div className="text-muted-foreground text-xs text-right">
                      {new Date(item.playedAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
             <div className="py-16 text-center text-muted-foreground">
              <p>Your listening history is empty.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
