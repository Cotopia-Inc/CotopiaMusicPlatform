import { useState } from "react";
import { useAdminListListeners } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Eye, Search, Heart, MessageSquare, UserCheck } from "lucide-react";
import { UserLink } from "@/components/user-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

function StatPill({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="w-3 h-3" />
      <span className="font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

export default function AdminListeners() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "master_admin" && user.role !== "moderator") navigate("/");
  }, [user, navigate]);

  const { data, isLoading } = useAdminListListeners({
    q: search || undefined,
    limit,
    offset: page * limit,
  });

  const listeners = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Eye className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Creator Metrics</h1>
          <p className="text-sm text-muted-foreground">Activity data for all creators</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            aria-label="Search creators"
            placeholder="Search creators..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Creators ({total.toLocaleString()})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {listeners.map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                        : u.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <UserLink
                          username={u.username}
                          userId={u.id}
                          role={(u as any).role ?? undefined}
                          isVerified={(u as any).isVerified}
                          className="text-sm font-medium"
                        />
                        {(u as any).isSuspended && (
                          <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded uppercase">Suspended</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-xs">
                      <StatPill icon={Heart} value={(u as any).favoriteCount ?? 0} label="faves" />
                      <StatPill icon={MessageSquare} value={(u as any).commentCount ?? 0} label="comments" />
                      <StatPill icon={UserCheck} value={(u as any).followCount ?? 0} label="follows" />
                    </div>
                    <p className="text-[10px] text-muted-foreground flex-shrink-0 hidden lg:block">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {listeners.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No creators found</p>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
