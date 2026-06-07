import { useGetDiscover, getGetDiscoverQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";
import { Link } from "wouter";

export default function Discover() {
  const { data: discover, isLoading } = useGetDiscover({
    query: { queryKey: getGetDiscoverQueryKey() }
  });

  return (
    <div className="space-y-12 pb-24">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Discover</h1>
        <p className="text-muted-foreground text-lg">Find your next favorite sound.</p>
      </div>

      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Trending Now</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : discover?.trendingSongs?.length ? (
            discover.trendingSongs.map((song) => (
              <Link key={song.id} href={`/songs/${song.id}`}>
                <div className="group cursor-pointer space-y-3">
                  <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Cover</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="bg-primary text-primary-foreground rounded-full p-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm truncate">{song.title}</h4>
                    <p className="text-xs text-muted-foreground truncate hover:underline">{song.artistName}</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No trending tracks found.</div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Top Rated</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : discover?.topRatedSongs?.length ? (
            discover.topRatedSongs.map((song) => (
              <Link key={song.id} href={`/songs/${song.id}`}>
                <div className="group cursor-pointer space-y-3">
                  <div className="aspect-square relative overflow-hidden rounded-md bg-secondary border border-border">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Cover</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm truncate">{song.title}</h4>
                    <p className="text-xs text-muted-foreground truncate hover:underline">{song.artistName}</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No top rated tracks found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
