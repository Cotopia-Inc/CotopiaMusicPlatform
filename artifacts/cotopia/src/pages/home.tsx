import { useGetHomeFeed, getGetHomeFeedQueryKey } from "@workspace/api-client-react";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function Home() {
  const { data: feed, isLoading } = useGetHomeFeed({
    query: {
      queryKey: getGetHomeFeedQueryKey()
    }
  });

  return (
    <div className="space-y-12 pb-24">
      {/* Hero Section */}
      <section className="relative rounded-2xl overflow-hidden aspect-[21/9] flex items-end p-8 border border-border group cursor-pointer hover:border-primary/50 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-card/50" />
        <div className="relative z-20 w-full max-w-2xl">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">Night Drive Radio</h2>
          <p className="text-muted-foreground text-lg mb-6 line-clamp-2">
            The perfect soundscape for lonely roads and empty highways. A cinematic mix of synthwave, ambient, and late-night indie.
          </p>
          <div className="flex gap-4">
            <button className="bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-full flex items-center gap-2 hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-current" /> Play Now
            </button>
          </div>
        </div>
      </section>

      {/* Featured Songs */}
      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Featured Tracks</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : feed?.featuredSongs?.length ? (
            feed.featuredSongs.map((song) => (
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
            <div className="col-span-full text-muted-foreground py-8">No featured tracks available.</div>
          )}
        </div>
      </section>
      
      {/* Featured Artists */}
      <section>
        <h3 className="text-2xl font-bold tracking-tight mb-6">Artists to Watch</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="space-y-4 text-center">
                <Skeleton className="w-32 h-32 rounded-full mx-auto" />
                <Skeleton className="h-4 w-2/3 mx-auto" />
              </div>
            ))
          ) : feed?.featuredArtists?.length ? (
            feed.featuredArtists.map((artist) => (
              <Link key={artist.id} href={`/artists/${artist.id}`}>
                <div className="group cursor-pointer space-y-4 text-center">
                  <div className="w-32 h-32 mx-auto relative overflow-hidden rounded-full bg-secondary border border-border">
                    {artist.avatarUrl ? (
                      <img src={artist.avatarUrl} alt={artist.stageName} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Photo</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm truncate">{artist.stageName}</h4>
                    <p className="text-xs text-muted-foreground truncate uppercase tracking-widest mt-1">Artist</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-muted-foreground py-8">No featured artists available.</div>
          )}
        </div>
      </section>
    </div>
  );
}
