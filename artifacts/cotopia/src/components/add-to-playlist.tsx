import { ListPlus, Check, Plus, Music } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useListPlaylists, useAddSongToPlaylist, getListPlaylistsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";

interface AddToPlaylistProps {
  songId: number;
  size?: "sm" | "default";
  className?: string;
}

export function AddToPlaylist({ songId, size = "sm", className }: AddToPlaylistProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addedIds, setAddedIds] = useState<number[]>([]);

  const { data: playlists } = useListPlaylists(
    { query: { queryKey: getListPlaylistsQueryKey(), enabled: !!user } }
  );

  const addMutation = useAddSongToPlaylist();

  if (!user) return null;

  function handleAdd(playlistId: number, playlistName: string) {
    if (addedIds.includes(playlistId)) return;
    addMutation.mutate(
      { id: playlistId, data: { songId } },
      {
        onSuccess: () => {
          setAddedIds(prev => [...prev, playlistId]);
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey() });
          toast({ title: `Added to "${playlistName}"` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Couldn't add to playlist" });
        },
      }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "sm" ? "icon" : "default"}
          className={className}
          title="Add to playlist"
          onClick={(e) => e.stopPropagation()}
        >
          <ListPlus className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
          {size !== "sm" && <span className="ml-1">Add to playlist</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Add to playlist</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
              onSelect={() => handleAdd(pl.id, pl.name)}
            >
              <span className="truncate">{pl.name}</span>
              {addedIds.includes(pl.id) && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-2" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
