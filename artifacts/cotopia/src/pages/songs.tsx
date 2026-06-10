import { useListSongs, getListSongsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { UserLink } from "@/components/user-link";
import { usePlayer } from "@/lib/player";

export default function Songs() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { play } = usePlayer();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListSongs(
    { q: debouncedSearch, limit: 50 },
    { query: { queryKey: getListSongsQueryKey({ q: debouncedSearch, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Songs</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search songs..." 
            className="pl-9 bg-secondary/50 border-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {isLoading ? (
          Array(12).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : data?.items?.length ? (
          data.items.map((song) => (
            <div key={song.id} className="group cursor-pointer space-y-3">
              <Link href={`/songs/${song.id}`}>
                <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Cover</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                      title={`Play ${song.title}`}
                      onClick={(e) => { e.preventDefault(); play({ id: song.id, title: song.title, artistName: song.artistName ?? "", artistId: song.artistId, artistIsVerified: song.artistIsVerified ?? false, coverUrl: song.coverUrl, streamUrl: song.streamUrl, duration: song.duration }); }}
                    >
                      <Play className="w-6 h-6 fill-current ml-1" />
                    </button>
                  </div>
                </div>
              </Link>
              <div>
                <Link href={`/songs/${song.id}`}>
                  <h4 className="font-semibold text-sm truncate hover:text-primary transition-colors">{song.title}</h4>
                </Link>
                <UserLink
                  username={song.artistName}
                  artistId={song.artistId}
                  role="artist"
                  className="text-xs text-muted-foreground truncate"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-muted-foreground py-12 text-center">No songs found matching your search.</div>
        )}
      </div>
    </div>
  );
}
