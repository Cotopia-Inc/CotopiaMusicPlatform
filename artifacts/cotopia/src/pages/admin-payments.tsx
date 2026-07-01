import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadges } from "@/components/role-badges";
import { format } from "date-fns";

interface PaymentRow {
  id: number;
  paypalOrderId: string | null;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  userId: number;
  submissionId: number | null;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorRole: string | null;
  submissionPlan: string | null;
  submissionType: string | null;
  paymentMode: string;
}

const PLAN_NAMES: Record<string, string> = {
  single: "Single Submission",
  basic: "Batch Submission",
  premium: "Featured Placement",
};

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{status}</Badge>;
    case "failed":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{status}</Badge>;
    case "refunded":
      return <Badge className="bg-secondary text-muted-foreground">{status}</Badge>;
    default:
      return <Badge className="bg-secondary text-muted-foreground">{status}</Badge>;
  }
}

export default function AdminPayments() {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading, isFetching, refetch } = useQuery<PaymentRow[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/payments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load payments");
      return res.json();
    },
  });

  const rows = data ?? [];
  const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground">All submission payment records</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading payments…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No payment records found.</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Creator</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Package</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Submission</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Transaction ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paged.map(row => {
                  const planLabel = row.submissionPlan ? (PLAN_NAMES[row.submissionPlan] ?? row.submissionPlan) : "—";
                  const typeLabel = row.submissionType === "song" ? "Music" : row.submissionType === "video" ? "Video" : null;
                  const packageLabel = typeLabel ? `${planLabel} · ${typeLabel}` : planLabel;

                  return (
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(row.createdAt), "MMM d, yyyy")}
                        <div className="text-[10px] text-muted-foreground/60">
                          {format(new Date(row.createdAt), "h:mm a")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{row.creatorDisplayName ?? row.creatorUsername ?? `User #${row.userId}`}</span>
                          {row.creatorRole && <RoleBadges role={row.creatorRole} />}
                        </div>
                        {row.creatorUsername && (
                          <div className="text-[11px] text-muted-foreground">@{row.creatorUsername}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{packageLabel}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.submissionId ? (
                          <span className="text-muted-foreground">#{row.submissionId}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-medium">
                        ${parseFloat(row.amount).toFixed(2)}
                        <span className="text-[10px] text-muted-foreground ml-1">{row.currency}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[180px]">
                        {row.paypalOrderId ? (
                          <span className="truncate block" title={row.paypalOrderId}>{row.paypalOrderId}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                          {row.paymentMode.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
