import { MoreHorizontal, ListMusic, ListPlus, Check, Plus, Music } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useListPlaylists, useAddSongToPlaylist, getListPlaylistsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { usePlayer, type Track } from "@/lib/player";

interface SongMenuSong {
  id: number;
  title: string;
  artistName?: string | null;
  artistId?: number | null;
  artistUserRole?: string | null;
  artistIsVerified?: boolean | null;
  coverUrl?: string | null;
  streamUrl?: string | null;
  duration?: number | null;
}

interface SongMenuProps {
  song: SongMenuSong;
  className?: string;
}

export function SongMenu({ song, className }: SongMenuProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addToQueue } = usePlayer();
  const [addedIds, setAddedIds] = useState<number[]>([]);

  const { data: playlists } = useListPlaylists(
    { query: { queryKey: getListPlaylistsQueryKey(), enabled: !!user } }
  );

  const addMutation = useAddSongToPlaylist();

  function handleAddToQueue() {
    const track: Track = {
      id: song.id,
      title: song.title,
      artistName: song.artistName ?? "",
      artistId: song.artistId,
      artistUserRole: song.artistUserRole ?? null,
      artistIsVerified: song.artistIsVerified ?? false,
      coverUrl: song.coverUrl,
      streamUrl: song.streamUrl,
      duration: song.duration ?? undefined,
    };
    addToQueue([track]);
    toast({ title: "Added to queue", description: song.title });
  }

  function handleAddToPlaylist(playlistId: number, playlistName: string) {
    if (addedIds.includes(playlistId)) return;
    addMutation.mutate(
      { id: playlistId, data: { songId: song.id } },
      {
        onSuccess: () => {
          setAddedIds(prev => [...prev, playlistId]);
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          toast({ title: `Added to "${playlistName}"` });
        },
        onError: () => toast({ variant: "destructive", title: "Couldn't add to playlist" }),
      }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          title="More options"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem className="cursor-pointer" onSelect={handleAddToQueue}>
          <ListMusic className="w-4 h-4 mr-2 flex-shrink-0" />
          Add to queue
        </DropdownMenuItem>
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <ListPlus className="w-4 h-4 mr-2 flex-shrink-0" />
                Add to playlist
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {!playlists?.length ? (
                  <div className="px-3 py-4 text-center space-y-2">
                    <Music className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs text-muted-foreground">No playlists yet</p>
                    <Link href="/library">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                        <Plus className="w-3 h-3" /> Create one
                      </button>
                    </Link>
                  </div>
                ) : (
                  playlists.map((pl) => (
                    <DropdownMenuItem
                      key={pl.id}
                      className="cursor-pointer flex items-center justify-between"
                      onSelect={() => handleAddToPlaylist(pl.id, pl.name)}
                    >
                      <span className="truncate">{pl.name}</span>
                      {addedIds.includes(pl.id) && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
