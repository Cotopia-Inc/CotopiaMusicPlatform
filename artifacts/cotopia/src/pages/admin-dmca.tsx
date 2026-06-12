import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, ExternalLink, RefreshCw, Clock, CheckCircle, XCircle, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUSES = ["all", "received", "under_review", "removed", "rejected", "counter_notice_received", "restored", "closed"] as const;

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  removed: "bg-red-500/20 text-red-400 border-red-500/30",
  rejected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  counter_notice_received: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  restored: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-secondary text-muted-foreground border-border",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  received: Clock,
  under_review: RefreshCw,
  removed: XCircle,
  rejected: XCircle,
  counter_notice_received: RotateCcw,
  restored: CheckCircle,
  closed: Shield,
};

interface DmcaClaim {
  id: number;
  claimantName: string;
  claimantEmail: string;
  claimantCompany?: string;
  copyrightOwner: string;
  workDescription: string;
  infringingUrl: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDmca() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<{ items: DmcaClaim[]; total: number }>({
    queryKey: ["admin-dmca", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/dmca?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const claims = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertOctagon className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">DMCA Claims</h1>
            <p className="text-sm text-muted-foreground">{total} total claim{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:border-border/80"
            }`}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No DMCA claims found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Claimant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Copyright Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, i) => {
                const StatusIcon = STATUS_ICONS[claim.status] ?? Shield;
                return (
                  <tr key={claim.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/5"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{claim.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{claim.claimantName}</p>
                      <p className="text-xs text-muted-foreground">{claim.claimantEmail}</p>
                      {claim.claimantCompany && <p className="text-xs text-muted-foreground">{claim.claimantCompany}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">{claim.copyrightOwner}</td>
                    <td className="px-4 py-3">
                      <Badge className={`gap-1 text-[10px] border ${STATUS_COLORS[claim.status] ?? "bg-secondary text-muted-foreground"}`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/dmca/${claim.id}`}>
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                          <ExternalLink className="w-3 h-3" />View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
