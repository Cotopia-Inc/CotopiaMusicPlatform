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
import { RoleBadges } from "@/components/role-badges";
import { Bug, Lightbulb, MessageSquare, Loader2, Save, Inbox, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminFeedback {
  id: number;
  userId: number;
  username: string | null;
  userRole: string | null;
  type: string;
  title: string;
  description: string;
  screenshotUrl: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const TYPE_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  bug: { label: "Bug", icon: Bug, className: "bg-red-500/15 text-red-400 border-red-500/30" },
  feature: { label: "Feature", icon: Lightbulb, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  general: { label: "General", icon: MessageSquare, className: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  resolved: { label: "Resolved", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  closed: { label: "Closed", className: "bg-secondary text-muted-foreground border-border" },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function AdminFeedback() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery<AdminFeedback[]>({
    queryKey: ["admin-feedback", type, status],
    queryFn: async () => {
      const params = new URLSearchParams({ type, status });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/feedback?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const items = data ?? [];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Beta Feedback</h1>
        <p className="text-muted-foreground">Review and respond to beta feedback submitted by users.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1.5">
          <label htmlFor="feedback-type-filter" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="feedback-type-filter" className="w-44 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="feedback-status-filter" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="feedback-status-filter" className="w-44 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          <p>No feedback found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} type={type} status={status} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ item, type, status }: { item: AdminFeedback; type: string; status: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.adminNotes ?? "");
  const typeMeta = TYPE_META[item.type] ?? TYPE_META.general;
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.open;
  const TypeIcon = typeMeta.icon;

  const updateMutation = useMutation({
    mutationFn: async (body: { status?: string; adminNotes?: string }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback updated" });
      qc.invalidateQueries({ queryKey: ["admin-feedback", type, status] });
    },
    onError: (err: unknown) =>
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not update feedback" }),
  });

  return (
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${typeMeta.className} border text-[10px] uppercase gap-1`}>
                <TypeIcon className="w-2.5 h-2.5" />{typeMeta.label}
              </Badge>
              <Badge className={`${statusMeta.className} border text-[10px] uppercase`}>
                {statusMeta.label}
              </Badge>
            </div>
            <h3 className="font-bold text-lg">{item.title}</h3>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>

        {item.screenshotUrl && (
          <a
            href={item.screenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline break-all inline-block"
          >
            {item.screenshotUrl}
          </a>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3" />
          </div>
          <span className="font-semibold text-foreground inline-flex items-center gap-0.5">
            @{item.username ?? "unknown"}
            <RoleBadges role={item.userRole} isVerified={false} />
          </span>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`feedback-card-status-${item.id}`} className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</label>
              <Select
                value={item.status}
                onValueChange={(v) => updateMutation.mutate({ status: v })}
              >
                <SelectTrigger id={`feedback-card-status-${item.id}`} className="w-44 bg-secondary/50 border-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`feedback-card-notes-${item.id}`} className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Admin notes</label>
            <Textarea
              id={`feedback-card-notes-${item.id}`}
              placeholder="Add a response or internal note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-secondary/50 border-secondary resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ adminNotes: notes })}
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
}
