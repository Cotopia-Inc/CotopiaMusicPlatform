import { useListLabels, getListLabelsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { RoleBadges } from "@/components/role-badges";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useSeo } from "@/hooks/use-seo";

export default function Labels() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useSeo({
    title: "Labels",
    description: "Explore record labels and their rosters of artists on Everyday Radio by Cotopia.",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListLabels(
    { q: debouncedSearch, limit: 50 },
    { query: { queryKey: getListLabelsQueryKey({ q: debouncedSearch, limit: 50 }) } }
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Record Labels</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search labels..." 
            className="pl-9 bg-secondary/50 border-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="w-full aspect-[2/1] rounded-xl" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))
        ) : data?.length ? (
          data.map((label) => (
            <Link key={label.id} href={`/labels/${label.id}`}>
              <div className="group cursor-pointer space-y-4 bg-card p-4 rounded-xl border border-border hover:border-primary/50 transition-colors">
                <div className="w-full aspect-[2/1] relative overflow-hidden rounded-lg bg-secondary flex items-center justify-center">
                  {label.logoUrl ? (
                    <img src={label.logoUrl} alt={label.name} className="max-w-[80%] max-h-[80%] object-contain group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="text-xl font-bold text-muted-foreground">{label.name}</span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-lg flex items-center gap-1.5"><span className="truncate">{label.name}</span><RoleBadges role="label" isVerified={label.isVerified ?? false} size="sm" /></h4>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>{label.artistCount || 0} Artists</span>
                    <span>{label.followerCount?.toLocaleString() || 0} Followers</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-muted-foreground py-12 text-center">No labels found matching your search.</div>
        )}
      </div>
    </div>
  );
}
