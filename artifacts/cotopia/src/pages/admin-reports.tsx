import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Flag, ShieldCheck, Eye, CheckCircle2, XCircle, Loader2,
  Music, Video, User, MessageSquare, Mail, AlertOctagon, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ReportRecord {
  id: number;
  reporterId: number;
  reporterUsername: string | null;
  targetType: string;
  targetId: number;
  reason: string;
  details: string | null;
  status: string;
  adminNotes: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

const REASON_ICONS: Record<string, React.ElementType> = {
  copyright: ShieldCheck,
  harassment: AlertOctagon,
  spam: Flag,
  fake_profile: User,
  illegal_content: AlertOctagon,
  other: Flag,
};

const TARGET_ICONS: Record<string, React.ElementType> = {
  song: Music,
  video: Video,
  profile: User,
  comment: MessageSquare,
  chat_message: MessageSquare,
  private_message: Mail,
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function targetHref(targetType: string, targetId: number): string | null {
  switch (targetType) {
    case "profile":
      return `/users/${targetId}`;
    case "song":
      return `/songs/${targetId}`;
    case "video":
      return `/videos/${targetId}`;
    default:
      return null;
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  reviewing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-secondary text-muted-foreground border-border",
};

export default function AdminReports() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<FilterValue>("pending");
  const [actionReport, setActionReport] = useState<{ report: ReportRecord; action: "resolved" | "dismissed" } | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const { data, isLoading } = useQuery<ReportRecord[]>({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      const url = status === "all"
        ? `${import.meta.env.BASE_URL}api/admin/reports`
        : `${import.meta.env.BASE_URL}api/admin/reports?status=${status}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: pendingData } = useQuery<ReportRecord[]>({
    queryKey: ["admin-reports", "pending"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/reports?status=pending`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { status?: string; adminNotes?: string } }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/reports/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const label = variables.body.status ? humanize(variables.body.status) : "Updated";
      toast({ title: `Report ${label.toLowerCase()}`, description: "The report has been updated." });
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      setActionReport(null);
      setActionNotes("");
    },
    onError: (err: unknown) => toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not update report" }),
  });

  const reports = data ?? [];
  const pendingCount = pendingData?.length ?? 0;

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Reports</h1>
        <p className="text-muted-foreground">Review and act on reports submitted by users.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={status === f.value ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setStatus(f.value)}
          >
            {f.label}
            {f.value === "pending" && pendingCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border text-[10px] px-1.5 ml-0.5">
                {pendingCount}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-card border border-border rounded-xl text-center py-20 text-muted-foreground">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="font-semibold">No reports found</p>
          <p className="text-sm text-muted-foreground/70">There are no {status === "all" ? "" : status} reports right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const ReasonIcon = REASON_ICONS[r.reason] ?? Flag;
            const TargetIcon = TARGET_ICONS[r.targetType] ?? Flag;
            const href = targetHref(r.targetType, r.targetId);
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <ReasonIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{humanize(r.reason)}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <TargetIcon className="w-3 h-3" />
                        {href ? (
                          <Link href={href} className="hover:text-foreground inline-flex items-center gap-0.5">
                            {r.targetType} #{r.targetId}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        ) : (
                          <span>{r.targetType.replace(/_/g, " ")} #{r.targetId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={`${STATUS_STYLES[r.status] ?? STATUS_STYLES.dismissed} border text-[10px] uppercase`}>
                    {r.status}
                  </Badge>
                </div>

                {r.details && (
                  <p className="text-sm text-foreground/90 bg-secondary/30 rounded-lg px-3 py-2">{r.details}</p>
                )}

                {r.adminNotes && (
                  <p className="text-xs text-muted-foreground italic">Notes: {r.adminNotes}</p>
                )}

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>
                      Reported by{" "}
                      <Link href={`/users/${r.reporterId}`} className="text-foreground/80 hover:text-foreground font-medium">
                        @{r.reporterUsername ?? r.reporterId}
                      </Link>
                    </span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                        onClick={() => updateMutation.mutate({ id: r.id, body: { status: "reviewing" } })}
                        disabled={updateMutation.isPending}
                      >
                        <Eye className="w-3 h-3" /> Start Review
                      </Button>
                    )}
                    {r.status !== "resolved" && r.status !== "dismissed" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => { setActionReport({ report: r, action: "resolved" }); setActionNotes(""); }}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-muted-foreground"
                          onClick={() => { setActionReport({ report: r, action: "dismissed" }); setActionNotes(""); }}
                        >
                          <XCircle className="w-3 h-3" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve / Dismiss dialog */}
      <Dialog open={actionReport !== null} onOpenChange={(open) => { if (!open) setActionReport(null); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {actionReport?.action === "resolved" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
              {actionReport?.action === "resolved" ? "Resolve Report" : "Dismiss Report"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {actionReport?.action === "resolved"
                ? "Mark this report as resolved. You can optionally add notes."
                : "Dismiss this report. You can optionally add notes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Admin notes (optional)"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="bg-secondary/50 border-secondary text-sm min-h-[80px]"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setActionReport(null)}>Cancel</Button>
              <Button
                size="sm"
                className={`gap-1.5 ${actionReport?.action === "resolved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                variant={actionReport?.action === "dismissed" ? "secondary" : "default"}
                onClick={() =>
                  actionReport &&
                  updateMutation.mutate({
                    id: actionReport.report.id,
                    body: { status: actionReport.action, adminNotes: actionNotes || undefined },
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : actionReport?.action === "resolved" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {actionReport?.action === "resolved" ? "Resolve" : "Dismiss"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
