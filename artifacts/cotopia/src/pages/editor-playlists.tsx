import { useState } from "react";
import {
  useListEditorialPlaylists, useCreateEditorialPlaylist, useUpdateEditorialPlaylist,
  useDeleteEditorialPlaylist, useAddSongToEditorialPlaylist, useRemoveSongFromEditorialPlaylist,
  useGetEditorialPlaylist, getListEditorialPlaylistsQueryKey, getGetEditorialPlaylistQueryKey,
  useListSongs,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ListMusic, Plus, Trash2, Edit3, Music, X, Search, Check } from "lucide-react";
import { RoleTag } from "@/components/role-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const EDITOR_ROLES = ["editor", "admin", "master_admin"];

const PLAYLIST_TYPES = [
  { value: "featured", label: "Featured" },
  { value: "mood", label: "Mood" },
  { value: "genre", label: "Genre Mix" },
  { value: "new_artist", label: "New Artists" },
  { value: "cotopia_picks", label: "Cotopia Picks" },
  { value: "radio_picks", label: "Radio Picks" },
];

const TYPE_COLORS: Record<string, string> = {
  featured: "bg-amber-500/20 text-amber-400",
  mood: "bg-blue-500/20 text-blue-400",
  genre: "bg-purple-500/20 text-purple-400",
  new_artist: "bg-green-500/20 text-green-400",
  cotopia_picks: "bg-primary/20 text-primary",
  radio_picks: "bg-pink-500/20 text-pink-400",
};

export default function EditorPlaylists() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !EDITOR_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const { data: playlists, isLoading } = useListEditorialPlaylists();
  const createPlaylist = useCreateEditorialPlaylist();
  const deletePlaylist = useDeleteEditorialPlaylist();
  const updatePlaylist = useUpdateEditorialPlaylist();
  const addSong = useAddSongToEditorialPlaylist();
  const removeSong = useRemoveSongFromEditorialPlaylist();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [manageSongsOpen, setManageSongsOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [songSearch, setSongSearch] = useState("");

  const [newForm, setNewForm] = useState({ name: "", description: "", playlistType: "featured", isPublic: true });
  const [editForm, setEditForm] = useState({ name: "", description: "", playlistType: "featured", isPublic: true });

  const { data: songsData } = useListSongs({ limit: 50, q: songSearch || undefined });
  const availableSongs = songsData?.items ?? [];

  const playlistDetailId = selectedPlaylist?.id ?? 0;
  const { data: playlistDetail, refetch: refetchDetail } = useGetEditorialPlaylist(
    playlistDetailId,
    { query: { enabled: !!selectedPlaylist && manageSongsOpen, queryKey: getGetEditorialPlaylistQueryKey(playlistDetailId) } }
  );

  async function handleCreate() {
    if (!newForm.name || !newForm.playlistType) return;
    try {
      await createPlaylist.mutateAsync({
        data: { name: newForm.name, description: newForm.description || undefined, playlistType: newForm.playlistType as any, isPublic: newForm.isPublic },
      });
      queryClient.invalidateQueries({ queryKey: getListEditorialPlaylistsQueryKey() });
      toast({ title: "Playlist created!" });
      setCreateOpen(false);
      setNewForm({ name: "", description: "", playlistType: "featured", isPublic: true });
    } catch {
      toast({ title: "Failed to create playlist", variant: "destructive" });
    }
  }

  async function handleUpdate() {
    if (!selectedPlaylist) return;
    try {
      await updatePlaylist.mutateAsync({
        id: selectedPlaylist.id,
        data: { name: editForm.name, description: editForm.description || undefined, playlistType: editForm.playlistType as any, isPublic: editForm.isPublic },
      });
      queryClient.invalidateQueries({ queryKey: getListEditorialPlaylistsQueryKey() });
      toast({ title: "Playlist updated!" });
      setEditOpen(false);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this editorial playlist?")) return;
    try {
      await deletePlaylist.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEditorialPlaylistsQueryKey() });
      toast({ title: "Playlist deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  async function handleAddSong(songId: number) {
    if (!selectedPlaylist) return;
    try {
      await addSong.mutateAsync({ id: selectedPlaylist.id, data: { songId } });
      refetchDetail();
      toast({ title: "Song added!" });
    } catch {
      toast({ title: "Failed to add song", variant: "destructive" });
    }
  }

  async function handleRemoveSong(songId: number) {
    if (!selectedPlaylist) return;
    try {
      await removeSong.mutateAsync({ id: selectedPlaylist.id, songId });
      refetchDetail();
      toast({ title: "Song removed" });
    } catch {
      toast({ title: "Failed to remove song", variant: "destructive" });
    }
  }

  const playlistSongIds = new Set((playlistDetail as any)?.songs?.map((s: any) => s.id) ?? []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListMusic className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Editorial Playlists</h1>
            <p className="text-sm text-muted-foreground">Curated playlists for Everyday Radio</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Playlist
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (playlists ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ListMusic className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No editorial playlists yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first playlist to start curating content</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 mt-2">
            <Plus className="w-4 h-4" />Create First Playlist
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(playlists ?? []).map((p: any) => (
            <Card key={p.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  {p.coverUrl
                    ? <img src={p.coverUrl} alt={p.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ListMusic className="w-6 h-6 text-primary" />
                      </div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{p.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize flex-shrink-0 ${TYPE_COLORS[p.playlistType] ?? "bg-muted text-muted-foreground"}`}>
                        {p.playlistType?.replace("_", " ")}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{p.songCount} songs · {p.isPublic ? "Public" : "Private"}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => { setSelectedPlaylist(p); setManageSongsOpen(true); }}
                  >
                    <Music className="w-3.5 h-3.5" />Manage Songs
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Edit playlist"
                    onClick={() => {
                      setSelectedPlaylist(p);
                      setEditForm({ name: p.name, description: p.description ?? "", playlistType: p.playlistType, isPublic: p.isPublic });
                      setEditOpen(true);
                    }}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:border-red-400/50"
                    title="Delete playlist"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Editorial Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-playlist-name">Name <span className="text-destructive">*</span></Label>
              <Input id="new-playlist-name" placeholder="Playlist name" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-playlist-description">Description</Label>
              <Input id="new-playlist-description" placeholder="Short description" value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-playlist-type">Type <span className="text-destructive">*</span></Label>
              <Select value={newForm.playlistType} onValueChange={v => setNewForm(f => ({ ...f, playlistType: v }))}>
                <SelectTrigger id="new-playlist-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYLIST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">Visible to all creators</p>
              </div>
              <Switch aria-label="Make playlist public" checked={newForm.isPublic} onCheckedChange={v => setNewForm(f => ({ ...f, isPublic: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createPlaylist.isPending || !newForm.name}>
              {createPlaylist.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-playlist-name">Name</Label>
              <Input id="edit-playlist-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-playlist-description">Description</Label>
              <Input id="edit-playlist-description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-playlist-type">Type</Label>
              <Select value={editForm.playlistType} onValueChange={v => setEditForm(f => ({ ...f, playlistType: v }))}>
                <SelectTrigger id="edit-playlist-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYLIST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground">Visible to all creators</p>
              </div>
              <Switch aria-label="Make playlist public" checked={editForm.isPublic} onCheckedChange={v => setEditForm(f => ({ ...f, isPublic: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updatePlaylist.isPending}>
              {updatePlaylist.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Songs Dialog */}
      <Dialog open={manageSongsOpen} onOpenChange={setManageSongsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Songs — {selectedPlaylist?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Current songs */}
            {((playlistDetail as any)?.songs ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">In Playlist</p>
                <div className="space-y-1">
                  {((playlistDetail as any)?.songs ?? []).map((song: any) => (
                    <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt={song.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{song.title}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><span className="truncate">{song.artistName}</span><RoleTag role={(song as any).artistUserRole} size="sm" /></p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" title="Remove from playlist" onClick={() => handleRemoveSong(song.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search to add */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add Songs</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search songs..." className="pl-8 h-8 text-sm" value={songSearch} onChange={e => setSongSearch(e.target.value)} />
              </div>
              <div className="space-y-1">
                {availableSongs.map((song: any) => {
                  const inPlaylist = playlistSongIds.has(song.id);
                  return (
                    <div key={song.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${inPlaylist ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"}`}
                      onClick={() => !inPlaylist && handleAddSong(song.id)}>
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt={song.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{song.title}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><span className="truncate">{song.artistName}</span><RoleTag role={(song as any).artistUserRole} size="sm" /></p>
                      </div>
                      {inPlaylist
                        ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        : <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setManageSongsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
