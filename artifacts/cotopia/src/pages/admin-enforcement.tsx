import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Shield, Clock, Ban, ChevronDown, UserSearch,
  CheckCircle2, Undo2, Plus, Loader2, User, ZapOff, Gavel,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { RoleBadges } from "@/components/role-badges";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

type ActionType = "warning" | "strike" | "suspension" | "ban";

interface EnforcementRow {
  id: number;
  userId: number;
  username: string | null;
  actionType: ActionType;
  reason: string;
  notes: string | null;
  issuedByUserId: number | null;
  isAutomated: boolean;
  status: "active" | "lifted";
  expiresAt: string | null;
  createdAt: string;
  liftedAt: string | null;
}

interface UserResult {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  isVerified: boolean;
  verificationType: string | null;
  isSuspended: boolean;
  isBanned: boolean;
}

const ACTION_CONFIG: Record<ActionType, { label: string; icon: React.ElementType; color: string; minRole: string }> = {
  warning:    { label: "Warning",    icon: AlertTriangle,  color: "bg-amber-500/15 text-amber-400 border-amber-500/30",  minRole: "moderator" },
  strike:     { label: "Strike",     icon: ZapOff,         color: "bg-orange-500/15 text-orange-400 border-orange-500/30", minRole: "admin" },
  suspension: { label: "Suspension", icon: Clock,          color: "bg-red-500/15 text-red-400 border-red-500/30",       minRole: "admin" },
  ban:        { label: "Permanent Ban", icon: Ban,         color: "bg-destructive/20 text-destructive border-destructive/30", minRole: "master_admin" },
};

const ROLE_WEIGHT: Record<string, number> = {
  listener: 0, artist: 0, label: 0, moderator: 1, editor: 1, admin: 2, master_admin: 3,
};

function canIssue(myRole: string, actionType: ActionType) {
  const required = { warning: 1, strike: 2, suspension: 2, ban: 3 };
  return (ROLE_WEIGHT[myRole] ?? 0) >= required[actionType];
}

export default function AdminEnforcement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterUserId, setFilterUserId] = useState<string>("");

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueUser, setIssueUser] = useState<UserResult | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionType, setActionType] = useState<ActionType>("warning");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [durationDays, setDurationDays] = useState("7");

  const [liftingId, setLiftingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<EnforcementRow[]>({
    queryKey: ["admin-enforcement", filterUserId],
    queryFn: async () => {
      const url = filterUserId
        ? `${import.meta.env.BASE_URL}api/admin/enforcement?userId=${filterUserId}`
        : `${import.meta.env.BASE_URL}api/admin/enforcement`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (filterType !== "all" && r.actionType !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  async function searchUsers(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-directory?search=${encodeURIComponent(q)}&limit=8`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!issueUser) throw new Error("No user selected");
      const body: Record<string, unknown> = {
        userId: issueUser.id,
        actionType,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      };
      if (actionType === "suspension" && durationDays) body.durationDays = Number(durationDays);

      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/enforcement`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to issue action");
      }
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["admin-enforcement"] });
      const cfg = ACTION_CONFIG[actionType];
      toast({ title: `${cfg.label} issued`, description: `Action applied to @${issueUser?.username}` });
      if (result.autoSuspension) {
        toast({ title: "Auto-suspension triggered", description: "Strike threshold reached — account suspended automatically." });
      }
      setIssueOpen(false);
      setIssueUser(null);
      setReason("");
      setNotes("");
      setUserSearch("");
      setSearchResults([]);
    },
    onError: (err: unknown) => toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to issue action" }),
  });

  async function handleLift(id: number) {
    setLiftingId(id);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/enforcement/${id}/lift`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      qc.invalidateQueries({ queryKey: ["admin-enforcement"] });
      toast({ title: "Action lifted" });
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to lift action" });
    } finally {
      setLiftingId(null);
    }
  }

  const myRole = (user as any)?.role ?? "listener";
  const availableActions = (Object.keys(ACTION_CONFIG) as ActionType[]).filter(a => canIssue(myRole, a));

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Enforcement</h1>
          <p className="text-muted-foreground">Issue and manage tiered community enforcement actions.</p>
        </div>
        {availableActions.length > 0 && (
          <Button className="gap-2 mt-2 flex-shrink-0" onClick={() => { setIssueOpen(true); setActionType(availableActions[0]); }}>
            <Plus className="w-4 h-4" /> Issue Action
          </Button>
        )}
      </div>

      {/* Tier legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(ACTION_CONFIG) as [ActionType, typeof ACTION_CONFIG[ActionType]][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          const count = (data ?? []).filter(r => r.actionType === type && r.status === "active").length;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "all" : type)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${filterType === type ? `${cfg.color} border` : "bg-card border-border hover:border-muted-foreground/30"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${filterType === type ? "bg-white/10" : "bg-secondary"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{count} active</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          {["active", "lifted", "all"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${filterStatus === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0 max-w-[260px]">
          <div className="relative">
            <UserSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              aria-label="Filter by user ID"
              placeholder="Filter by user ID…"
              value={filterUserId}
              onChange={e => setFilterUserId(e.target.value)}
              className="pl-8 h-8 text-xs bg-secondary/50"
            />
          </div>
        </div>
        {(filterType !== "all" || filterStatus !== "active" || filterUserId) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterType("all"); setFilterStatus("active"); setFilterUserId(""); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full max-w-sm" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl text-center py-20 text-muted-foreground">
          <Gavel className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="font-semibold">No enforcement actions</p>
          <p className="text-sm">No {filterStatus === "all" ? "" : filterStatus} {filterType === "all" ? "" : filterType} actions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const cfg = ACTION_CONFIG[r.actionType];
            const Icon = cfg.icon;
            const isActive = r.status === "active";
            const canLift = isActive && (
              r.actionType === "ban" ? myRole === "master_admin" : ["admin", "master_admin"].includes(myRole)
            );
            return (
              <div key={r.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 ${isActive ? "border-border" : "border-border/50 opacity-70"}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color.replace("border-", "border ").split(" ")[0]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/users/${r.userId}`}>
                        <span className="font-semibold hover:underline cursor-pointer">@{r.username ?? r.userId}</span>
                      </Link>
                      <Badge className={`${cfg.color} border text-[10px] uppercase px-1.5`}>{cfg.label}</Badge>
                      {r.isAutomated && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Auto</Badge>
                      )}
                      {isActive ? (
                        <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Lifted</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canLift && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => handleLift(r.id)}
                          disabled={liftingId === r.id}
                        >
                          {liftingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                          Lift
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 mt-1">{r.reason}</p>
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{r.notes}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                    {r.expiresAt && isActive && (
                      <>
                        <span>·</span>
                        <span>Expires {formatDistanceToNow(new Date(r.expiresAt), { addSuffix: true })}</span>
                      </>
                    )}
                    {r.liftedAt && (
                      <>
                        <span>·</span>
                        <span>Lifted {formatDistanceToNow(new Date(r.liftedAt), { addSuffix: true })}</span>
                      </>
                    )}
                    {!r.isAutomated && r.issuedByUserId && (
                      <>
                        <span>·</span>
                        <span>by staff #{r.issuedByUserId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Action Dialog */}
      <Dialog open={issueOpen} onOpenChange={open => { if (!open) { setIssueOpen(false); setIssueUser(null); setUserSearch(""); setSearchResults([]); setReason(""); setNotes(""); } }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Gavel className="w-4 h-4" /> Issue Enforcement Action
            </DialogTitle>
            <DialogDescription className="text-xs">
              Warnings: moderator+. Strikes/Suspensions: admin+. Permanent bans: master admin only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target user *</label>
              {issueUser ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">@{issueUser.username}</span>
                    <RoleBadges role={issueUser.role} isVerified={issueUser.isVerified} verificationType={issueUser.verificationType ?? undefined} />
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIssueUser(null)}>Change</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    aria-label="Search by username"
                    placeholder="Search by username…"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                    className="text-sm"
                  />
                  {searching && <p className="text-xs text-muted-foreground px-1">Searching…</p>}
                  {searchResults.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => { setIssueUser(u); setSearchResults([]); setUserSearch(""); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60 text-left"
                        >
                          <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>@{u.username}</span>
                          <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                          {u.isBanned && <Badge variant="destructive" className="text-[9px] ml-auto">Banned</Badge>}
                          {u.isSuspended && !u.isBanned && <Badge className="bg-orange-500/20 text-orange-400 text-[9px] ml-auto">Suspended</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action type */}
            <div>
              <label htmlFor="enforcement-action-type" className="text-xs font-medium text-muted-foreground mb-1.5 block">Action type *</label>
              <Select value={actionType} onValueChange={v => setActionType(v as ActionType)}>
                <SelectTrigger id="enforcement-action-type" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableActions.map(a => {
                    const cfg = ACTION_CONFIG[a];
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={a} value={a}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Duration (suspension only) */}
            {actionType === "suspension" && (
              <div>
                <label htmlFor="enforcement-duration" className="text-xs font-medium text-muted-foreground mb-1.5 block">Duration (days)</label>
                <Input
                  id="enforcement-duration"
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={e => setDurationDays(e.target.value)}
                  className="text-sm"
                  placeholder="e.g. 7"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank for indefinite.</p>
              </div>
            )}

            {/* Reason */}
            <div>
              <label htmlFor="enforcement-reason" className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason (visible to user) *</label>
              <Textarea
                id="enforcement-reason"
                placeholder="State why this action is being taken…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="min-h-[80px] text-sm bg-secondary/50"
                maxLength={1000}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="enforcement-notes" className="text-xs font-medium text-muted-foreground mb-1.5 block">Internal notes (optional)</label>
              <Textarea
                id="enforcement-notes"
                placeholder="Staff-only context…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="min-h-[60px] text-sm bg-secondary/50"
                maxLength={500}
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setIssueOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className={`gap-1.5 ${actionType === "ban" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
                onClick={() => issueMutation.mutate()}
                disabled={issueMutation.isPending || !issueUser || !reason.trim()}
              >
                {issueMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                Issue {ACTION_CONFIG[actionType].label}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
