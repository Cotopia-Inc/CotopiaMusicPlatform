import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadges } from "@/components/role-badges";
import { format } from "date-fns";

interface PaymentRow {
  id: number;
  paypalOrderId: string | null;
  externalTransactionId: string | null;
  demoConfirmationNumber: string | null;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  paymentMode: string;
  isDemo: boolean;
  createdAt: string;
  userId: number;
  submissionId: number | null;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorRole: string | null;
  submissionPlan: string | null;
  submissionType: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  single: "Single",
  basic: "Batch",
  premium: "Featured",
};

type FilterMode = "all" | "demo" | "paypal_sandbox" | "paypal_live";

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
    case "initiated":
    case "pending":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{status}</Badge>;
    case "failed":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{status}</Badge>;
    case "refunded":
    case "canceled":
      return <Badge className="bg-secondary text-muted-foreground">{status}</Badge>;
    case "disputed":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">{status}</Badge>;
    default:
      return <Badge className="bg-secondary text-muted-foreground">{status}</Badge>;
  }
}

function modeBadge(paymentMode: string, isDemo: boolean) {
  if (isDemo || paymentMode === "demo") {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1">
        <TestTube2 className="w-2.5 h-2.5" />DEMO
      </Badge>
    );
  }
  if (paymentMode === "paypal_sandbox") {
    return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">SANDBOX</Badge>;
  }
  if (paymentMode === "paypal_live") {
    return <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">LIVE</Badge>;
  }
  return <Badge className="bg-secondary text-muted-foreground text-[10px]">{paymentMode}</Badge>;
}

export default function AdminPayments() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterMode>("all");
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

  // Separate demo from real for summary (never mix)
  const demoRows    = rows.filter(r => r.isDemo || r.paymentMode === "demo");
  const sandboxRows = rows.filter(r => !r.isDemo && r.paymentMode === "paypal_sandbox");
  const liveRows    = rows.filter(r => !r.isDemo && r.paymentMode === "paypal_live");

  const demoCompleted    = demoRows.filter(r => r.status === "completed");
  const sandboxCompleted = sandboxRows.filter(r => r.status === "completed");
  const liveCompleted    = liveRows.filter(r => r.status === "completed");

  const demoTotal    = demoCompleted.reduce((s, r) => s + parseFloat(r.amount), 0);
  const sandboxTotal = sandboxCompleted.reduce((s, r) => s + parseFloat(r.amount), 0);
  const liveTotal    = liveCompleted.reduce((s, r) => s + parseFloat(r.amount), 0);

  const filtered = filter === "all" ? rows
    : filter === "demo" ? demoRows
    : filter === "paypal_sandbox" ? sandboxRows
    : liveRows;

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground">All submission payment records — demo revenue never mixed with real</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards — demo always separated from real */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Demo Transactions</p>
            </div>
            <p className="text-2xl font-bold">{demoCompleted.length}</p>
            <p className="text-sm text-muted-foreground font-mono">${demoTotal.toFixed(2)} USD simulated</p>
            <p className="text-[10px] text-amber-400/70">Not real revenue — demonstration only</p>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">PayPal Sandbox</p>
            </div>
            <p className="text-2xl font-bold">{sandboxCompleted.length}</p>
            <p className="text-sm text-muted-foreground font-mono">${sandboxTotal.toFixed(2)} USD test</p>
            <p className="text-[10px] text-blue-400/70">Not real revenue — sandbox only</p>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-400" />
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Live Revenue</p>
            </div>
            <p className="text-2xl font-bold">{liveCompleted.length}</p>
            <p className="text-sm text-muted-foreground font-mono">${liveTotal.toFixed(2)} USD</p>
            <p className="text-[10px] text-green-400/70">Real transactions only</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "demo", "paypal_sandbox", "paypal_live"] as FilterMode[]).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "secondary" : "outline"}
            onClick={() => { setFilter(f); setPage(0); }}
          >
            {f === "all" ? "All" : f === "demo" ? "Demo" : f === "paypal_sandbox" ? "Sandbox" : "Live"}
            <span className="ml-1.5 text-muted-foreground text-xs">
              ({f === "all" ? rows.length : f === "demo" ? demoRows.length : f === "paypal_sandbox" ? sandboxRows.length : liveRows.length})
            </span>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading payments…</div>
      ) : filtered.length === 0 ? (
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Sub #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Confirmation</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paged.map(row => {
                  const planLabel = row.submissionPlan ? (PLAN_NAMES[row.submissionPlan] ?? row.submissionPlan) : "—";
                  const typeLabel = row.submissionType === "song" ? "Music" : row.submissionType === "video" ? "Video" : null;
                  const packageLabel = typeLabel ? `${planLabel} · ${typeLabel}` : planLabel;
                  const confirmationRef = row.demoConfirmationNumber
                    ?? row.externalTransactionId
                    ?? row.paypalOrderId;

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
                        {confirmationRef ? (
                          <span className="truncate block" title={confirmationRef}>{confirmationRef}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3">{modeBadge(row.paymentMode, row.isDemo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
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
