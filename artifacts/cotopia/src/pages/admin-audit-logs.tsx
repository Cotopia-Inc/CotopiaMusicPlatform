import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
  id: number;
  adminUserId: number;
  adminUsername?: string;
  action: string;
  targetType?: string;
  targetId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  dmca_status_update: "bg-red-500/20 text-red-400 border-red-500/30",
  copyright_strike_issued: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  legal_settings_updated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  role_changed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  user_suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  content_approved: "bg-green-500/20 text-green-400 border-green-500/30",
  content_rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  content_removed: "bg-red-500/20 text-red-400 border-red-500/30",
  settings_changed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading, refetch } = useQuery<{ items: AuditLog[]; total: number }>({
    queryKey: ["admin-audit-logs", page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("cotopia_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">{total} total entr{total !== 1 ? "ies" : "y"}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No audit log entries yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/5"}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    {log.adminUsername ?? `User #${log.adminUserId}`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] border ${ACTION_COLORS[log.action] ?? "bg-secondary text-muted-foreground border-border"}`}>
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.targetType && log.targetId ? `${log.targetType} #${log.targetId}` : log.targetType ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[300px] truncate">
                    {log.description ?? "—"}
                  </td>
                </tr>
              ))}
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
