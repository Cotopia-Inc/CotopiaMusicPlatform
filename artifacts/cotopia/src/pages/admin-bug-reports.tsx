import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bug, Inbox, Loader2, Save, User, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BugReport {
  id: number;
  userId: number | null;
  username: string | null;
  userEmail: string | null;
  whatHappened: string;
  pageUrl: string | null;
  whatTrying: string | null;
  deviceBrowser: string | null;
  severity: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: "Low",    className: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  high:   { label: "High",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  urgent: { label: "Urgent", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  new:           { label: "New",           className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  confirmed:     { label: "Confirmed",     className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  investigating: { label: "Investigating", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  fixed:         { label: "Fixed",         className: "bg-green-500/15 text-green-400 border-green-500/30" },
  closed:        { label: "Closed",        className: "bg-secondary text-muted-foreground border-border" },
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "investigating", label: "Investigating" },
  { value: "fixed", label: "Fixed" },
  { value: "closed", label: "Closed" },
];

export default function AdminBugReports() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading } = useQuery<{ items: BugReport[]; total: number }>({
    queryKey: ["admin-bug-reports", statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter, severity: severityFilter });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-feedback/bug-reports?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin · Beta Feedback</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
          <Bug className="w-7 h-7 text-red-400" />
          Bug Reports
        </h1>
        <p className="text-muted-foreground">Review and track bugs reported by users.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Severity</label>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data && (
          <p className="text-sm text-muted-foreground self-end pb-0.5">{data.total} report{data.total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          <p>No bug reports found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <BugReportCard key={item.id} item={item} statusFilter={statusFilter} severityFilter={severityFilter} />
          ))}
        </div>
      )}
    </div>
  );
}

function BugReportCard({ item, statusFilter, severityFilter }: {
  item: BugReport;
  statusFilter: string;
  severityFilter: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.adminNotes ?? "");

  const severityMeta = SEVERITY_META[item.severity] ?? SEVERITY_META.medium;
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.new;

  const mutation = useMutation({
    mutationFn: async (body: { status?: string; adminNotes?: string }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-feedback/bug-reports/${item.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bug report updated" });
      qc.invalidateQueries({ queryKey: ["admin-bug-reports", statusFilter, severityFilter] });
    },
    onError: (err: unknown) =>
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not update" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${severityMeta.className} border text-[10px] uppercase`}>{severityMeta.label}</Badge>
            <Badge className={`${statusMeta.className} border text-[10px] uppercase`}>{statusMeta.label}</Badge>
          </div>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What happened</p>
        <p className="text-sm whitespace-pre-wrap">{item.whatHappened}</p>
      </div>

      {item.whatTrying && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What they were trying</p>
          <p className="text-sm text-muted-foreground">{item.whatTrying}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {item.pageUrl && (
          <a href={item.pageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline truncate max-w-xs">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            {item.pageUrl}
          </a>
        )}
        {item.deviceBrowser && (
          <span className="truncate max-w-xs">{item.deviceBrowser}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="w-3 h-3" />
        </div>
        {item.username ? (
          <span className="font-semibold text-foreground">@{item.username}</span>
        ) : item.userEmail ? (
          <span>{item.userEmail}</span>
        ) : (
          <span className="italic text-muted-foreground/50">Anonymous</span>
        )}
      </div>

      <div className="border-t border-border/50 pt-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</label>
            <Select
              value={item.status}
              onValueChange={(v) => mutation.mutate({ status: v })}
            >
              <SelectTrigger className="w-44 bg-secondary/50 border-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Admin notes</label>
          <Textarea
            placeholder="Internal notes or response…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="bg-secondary/50 border-secondary resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" disabled={mutation.isPending} onClick={() => mutation.mutate({ adminNotes: notes })}>
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
