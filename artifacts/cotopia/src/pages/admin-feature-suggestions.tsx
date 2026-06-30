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
import { Lightbulb, Inbox, Loader2, Save, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeatureSuggestion {
  id: number;
  userId: number | null;
  username: string | null;
  userEmail: string | null;
  title: string;
  description: string;
  why: string | null;
  category: string;
  priority: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const CATEGORY_LABEL: Record<string, string> = {
  music: "Music", videos: "Videos", podcasts: "Podcasts",
  profile: "Profile", upload: "Upload", discovery: "Discovery",
  payments: "Payments", community: "Community", other: "Other",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  new:         { label: "New",         className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  reviewed:    { label: "Reviewed",    className: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  planned:     { label: "Planned",     className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  completed:   { label: "Completed",   className: "bg-green-500/15 text-green-400 border-green-500/30" },
  declined:    { label: "Declined",    className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  nice_to_have: { label: "Nice to have", className: "bg-secondary text-muted-foreground border-border" },
  important:    { label: "Important",    className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  urgent:       { label: "Urgent",       className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

export default function AdminFeatureSuggestions() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading } = useQuery<{ items: FeatureSuggestion[]; total: number }>({
    queryKey: ["admin-feature-suggestions", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter, category: categoryFilter });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-feedback/feature-suggestions?${params}`, {
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
          <Lightbulb className="w-7 h-7 text-violet-400" />
          Feature Suggestions
        </h1>
        <p className="text-muted-foreground">Review and triage user-submitted feature ideas.</p>
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
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data && (
          <p className="text-sm text-muted-foreground self-end pb-0.5">{data.total} suggestion{data.total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          <p>No suggestions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <SuggestionCard key={item.id} item={item} statusFilter={statusFilter} categoryFilter={categoryFilter} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ item, statusFilter, categoryFilter }: {
  item: FeatureSuggestion;
  statusFilter: string;
  categoryFilter: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.adminNotes ?? "");

  const statusMeta = STATUS_META[item.status] ?? STATUS_META.new;
  const priorityMeta = PRIORITY_META[item.priority] ?? PRIORITY_META.nice_to_have;

  const mutation = useMutation({
    mutationFn: async (body: { status?: string; adminNotes?: string }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/beta-feedback/feature-suggestions/${item.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Suggestion updated" });
      qc.invalidateQueries({ queryKey: ["admin-feature-suggestions", statusFilter, categoryFilter] });
    },
    onError: (err: unknown) =>
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Could not update" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 border text-[10px] uppercase">
              {CATEGORY_LABEL[item.category] ?? item.category}
            </Badge>
            <Badge className={`${statusMeta.className} border text-[10px] uppercase`}>{statusMeta.label}</Badge>
            <Badge className={`${priorityMeta.className} border text-[10px] uppercase`}>{priorityMeta.label}</Badge>
          </div>
          <h3 className="font-bold text-lg leading-tight">{item.title}</h3>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </div>

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>

      {item.why && (
        <div className="bg-secondary/30 rounded-lg px-3 py-2 border border-border/50">
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Why it matters: </span>{item.why}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="w-3 h-3" />
        </div>
        {item.username ? (
          <span className="font-semibold text-foreground">@{item.username}</span>
        ) : item.userEmail ? (
          <span className="text-muted-foreground">{item.userEmail}</span>
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
