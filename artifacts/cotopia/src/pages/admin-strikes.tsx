import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, ShieldOff, RotateCcw, Search, Music, Video,
  FileText, AlertOctagon, Loader2, ShieldCheck, ChevronLeft, ChevronRight, User,
} from "lucide-react";
import { format } from "date-fns";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface StrikeRecord {
  id: number;
  userId: number;
  username: string;
  email: string;
  displayName: string | null;
  contentType: string;
  contentId: number | null;
  contentTitle: string | null;
  strikeReason: string;
  internalNotes: string | null;
  issuedByUsername: string | null;
  dmcaClaimId: number | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedReason: string | null;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const CONTENT_ICONS: Record<string, React.ElementType> = {
  song: Music,
  video: Video,
  submission: FileText,
  comment: AlertOctagon,
  chat_message: AlertOctagon,
  company_post: FileText,
};

export default function AdminStrikes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const limit = 30;
  const [search, setSearch] = useState("");
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolveReason, setResolveReason] = useState("");
  const [issueTarget, setIssueTarget] = useState<StrikeTarget | null>(null);

  const { data, isLoading } = useQuery<{ items: StrikeRecord[]; total: number }>({
    queryKey: ["admin-strikes", page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/strikes?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/strikes/${id}/resolve`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ resolvedReason: reason || "Revoked by admin" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Strike revoked", description: "The copyright strike has been removed." });
      qc.invalidateQueries({ queryKey: ["admin-strikes"] });
      setResolveId(null);
      setResolveReason("");
    },
    onError: () => toast({ variant: "destructive", title: "Could not revoke strike" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const activeStrikes = items.filter(s => s.status === "active").length;

  const filtered = search
    ? items.filter(s =>
        s.username?.toLowerCase().includes(search.toLowerCase()) ||
        s.contentTitle?.toLowerCase().includes(search.toLowerCase()) ||
        s.strikeReason?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Copyright Strikes</h1>
          <p className="text-muted-foreground">Track and manage copyright strikes issued to users.</p>
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 mt-2"
          onClick={() => setIssueTarget({
            userId: 0,
            uploaderName: "",
            contentType: "song",
            contentId: undefined,
            contentTitle: "",
          })}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Issue Strike
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Total Strikes</p>
          <p className="text-3xl font-extrabold">{total}</p>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl p-4 space-y-1">
          <p className="text-xs text-red-400 uppercase tracking-widest">Active (This Page)</p>
          <p className="text-3xl font-extrabold text-red-400">{activeStrikes}</p>
        </div>
        <div className="bg-card border border-green-500/20 rounded-xl p-4 space-y-1">
          <p className="text-xs text-green-400 uppercase tracking-widest">Resolved (This Page)</p>
          <p className="text-3xl font-extrabold text-green-400">{items.filter(s => s.status === "resolved").length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter by user, content, or reason…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-secondary"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">User</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Content</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reason</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Issued</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(6).fill(0).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
                    <p>No strikes found.</p>
                  </td>
                </tr>
              ) : filtered.map((s) => {
                const ContentIcon = CONTENT_ICONS[s.contentType] ?? FileText;
                const isActive = s.status === "active";
                return (
                  <tr key={s.id} className={isActive ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">@{s.username}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[130px]">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ContentIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wide mb-0.5">
                            {s.contentType.replace(/_/g, " ")}
                          </Badge>
                          {s.contentTitle && <p className="text-xs text-foreground truncate max-w-[120px]">{s.contentTitle}</p>}
                          {!s.contentTitle && s.contentId && <p className="text-xs text-muted-foreground">#{s.contentId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-sm truncate" title={s.strikeReason}>{s.strikeReason}</p>
                      {s.internalNotes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 italic" title={s.internalNotes}>
                          Note: {s.internalNotes}
                        </p>
                      )}
                      {s.issuedByUsername && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">by @{s.issuedByUsername}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-[10px] uppercase gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />Active
                        </Badge>
                      ) : (
                        <div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-[10px] uppercase gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />Resolved
                          </Badge>
                          {s.resolvedAt && <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(s.resolvedAt), "MMM d, yyyy")}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(s.createdAt), "MMM d, yyyy")}
                      {s.dmcaClaimId && (
                        <p className="text-[10px] text-primary/70 mt-0.5">DMCA #{s.dmcaClaimId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => { setResolveId(s.id); setResolveReason(""); }}
                        >
                          <RotateCcw className="w-3 h-3" />Undo
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">{s.resolvedReason || "Resolved"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">{total} total strikes</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve/Undo dialog */}
      <Dialog open={resolveId !== null} onOpenChange={open => { if (!open) setResolveId(null); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="w-4 h-4 text-green-400" />
              Revoke Strike
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will mark the strike as resolved and remove it from the user's active count.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Reason for revoking (optional)"
              value={resolveReason}
              onChange={e => setResolveReason(e.target.value)}
              className="bg-secondary/50 border-secondary text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => resolveId !== null && resolveMutation.mutate({ id: resolveId, reason: resolveReason })}
                disabled={resolveMutation.isPending}
              >
                {resolveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                Revoke Strike
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue strike modal (manual) */}
      {issueTarget !== null && issueTarget.userId === 0 ? (
        <ManualStrikeForm onClose={() => setIssueTarget(null)} onSuccess={() => { qc.invalidateQueries({ queryKey: ["admin-strikes"] }); setIssueTarget(null); }} />
      ) : (
        <CopyrightStrikeModal
          target={issueTarget}
          onClose={() => setIssueTarget(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-strikes"] })}
        />
      )}
    </div>
  );
}

function ManualStrikeForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [contentType, setContentType] = useState("song");
  const [contentTitle, setContentTitle] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    if (!userId || !reason) return;
    setIsPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/strikes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, contentType, contentTitle: contentTitle || undefined, strikeReason: reason, internalNotes: notes || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Strike issued" });
      onSuccess();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Issue Strike Manually
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">User ID, username, or email <span className="text-red-400">*</span></label>
            <Input placeholder="e.g. nova@example.com or nova_sounds" value={userId} onChange={e => setUserId(e.target.value)} className="bg-secondary/50 border-secondary text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Content Type</label>
              <select value={contentType} onChange={e => setContentType(e.target.value)} className="w-full h-9 rounded-md border border-secondary bg-secondary/50 px-2 text-sm text-foreground">
                {["song","video","submission","comment","chat_message","company_post"].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g," ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Content Title</label>
              <Input placeholder="Optional" value={contentTitle} onChange={e => setContentTitle(e.target.value)} className="bg-secondary/50 border-secondary text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Reason <span className="text-red-400">*</span></label>
            <Input placeholder="Strike reason" value={reason} onChange={e => setReason(e.target.value)} className="bg-secondary/50 border-secondary text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Internal notes</label>
            <Input placeholder="Optional" value={notes} onChange={e => setNotes(e.target.value)} className="bg-secondary/50 border-secondary text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleSubmit} disabled={!userId || !reason || isPending}>
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Issue Strike"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
