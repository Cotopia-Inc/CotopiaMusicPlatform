import { useListArtists, getListArtistsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { RoleBadges } from "@/components/role-badges";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useSeo } from "@/hooks/use-seo";

export default function Artists() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useSeo({
    title: "Artists",
    description: "Discover emerging and independent artists on Everyday Radio by Cotopia.",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListArtists(
    { q: debouncedSearch, limit: 50 },
    { query: { queryKey: getListArtistsQueryKey({ q: debouncedSearch, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Artists</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            aria-label="Search artists"
            placeholder="Search artists..." 
            className="pl-9 bg-secondary/50 border-secondary rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
        {isLoading ? (
          Array(12).fill(0).map((_, i) => (
            <div key={i} className="space-y-4 text-center">
              <Skeleton className="w-full aspect-square rounded-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
          ))
        ) : data?.length ? (
          data.map((artist) => (
            <Link key={artist.id} href={`/artists/${artist.id}`}>
              <div className="group cursor-pointer space-y-4 text-center">
                <div className="w-full aspect-square relative overflow-hidden rounded-full bg-secondary border border-border shadow-lg">
                  {artist.avatarUrl ? (
                    <img src={artist.avatarUrl} alt={artist.stageName} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground bg-card">
                      {artist.stageName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-base flex items-center justify-center gap-1"><span className="truncate">{artist.stageName}</span><RoleBadges role="artist" isVerified={artist.isVerified} size="sm" /></h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {artist.followerCount?.toLocaleString()} followers
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-muted-foreground py-12 text-center">No artists found matching your search.</div>
        )}
      </div>
    </div>
  );
}
