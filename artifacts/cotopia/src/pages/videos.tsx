import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Link } from "wouter";

export default function Videos() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListVideos(
    { q: debouncedSearch, limit: 50 },
    { query: { queryKey: getListVideosQueryKey({ q: debouncedSearch, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight">Videos</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search videos..." 
            className="pl-9 bg-secondary/50 border-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : data?.items?.length ? (
          data.items.map((video) => (
            <Link key={video.id} href={`/videos/${video.id}`}>
              <div className="group cursor-pointer space-y-3">
                <div className="aspect-video relative overflow-hidden rounded-md bg-secondary border border-border">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Thumbnail</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-primary text-primary-foreground rounded-full p-4 transform scale-90 group-hover:scale-100 transition-all duration-300">
                      <Play className="w-8 h-8 fill-current ml-1" />
                    </button>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm truncate">{video.title}</h4>
                  <p className="text-xs text-muted-foreground truncate hover:underline">{video.artistName}</p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-muted-foreground py-12 text-center">No videos found matching your search.</div>
        )}
      </div>
    </div>
  );
}
