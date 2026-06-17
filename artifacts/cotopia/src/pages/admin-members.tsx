import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, BadgeCheck, Loader2, Gavel, RotateCcw, ShieldOff, AlertTriangle, Bot,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

interface DirectoryUser {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
}

interface EnforcementAction {
  id: number;
  userId: number;
  username: string | null;
  actionType: "warning" | "strike" | "suspension" | "ban";
  reason: string;
  notes: string | null;
  issuedByUserId: number | null;
  isAutomated: boolean;
  status: "active" | "lifted";
  expiresAt: string | null;
  createdAt: string;
  liftedAt: string | null;
}

type ActionType = "warning" | "strike" | "suspension" | "ban";
type VerificationType = "artist" | "label";

const ACTION_BADGE: Record<ActionType, string> = {
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  strike: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  suspension: "bg-red-500/20 text-red-400 border-red-500/30",
  ban: "bg-black text-white border-border",
};

function UserPicker({
  users, value, onChange, placeholder,
}: {
  users: DirectoryUser[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const selected = users.find(u => u.id === value);
  const display = selected ? `@${selected.username}` : text;

  return (
    <div className="space-y-1.5">
      <Input
        list="cotopia-user-directory"
        placeholder={placeholder ?? "Search by @username…"}
        value={display}
        onChange={e => {
          const raw = e.target.value;
          setText(raw);
          const clean = raw.replace(/^@/, "").trim().toLowerCase();
          const match = users.find(u => u.username.toLowerCase() === clean);
          onChange(match ? match.id : null);
        }}
        className="bg-secondary/50 border-secondary text-sm"
      />
      <datalist id="cotopia-user-directory">
        {users.map(u => (
          <option key={u.id} value={`@${u.username}`}>
            {u.displayName ?? u.username} · {u.role}
          </option>
        ))}
      </datalist>
      {value !== null && selected && (
        <p className="text-[11px] text-muted-foreground">
          Selected: {selected.displayName ?? selected.username} (#{selected.id})
        </p>
      )}
    </div>
  );
}

export default function AdminMembers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: directory = [] } = useQuery<DirectoryUser[]>({
    queryKey: ["admin-user-directory"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-directory`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load directory");
      return res.json();
    },
  });

  const { data: history = [], isLoading } = useQuery<EnforcementAction[]>({
    queryKey: ["admin-enforcement"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/enforcement`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load enforcement history");
      return res.json();
    },
  });

  // Enforcement form state
  const [enforceUserId, setEnforceUserId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<ActionType>("warning");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [durationDays, setDurationDays] = useState("");

  // Verification form state
  const [verifyUserId, setVerifyUserId] = useState<number | null>(null);
  const [verificationType, setVerificationType] = useState<VerificationType>("artist");

  const enforceMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        userId: enforceUserId,
        actionType,
        reason,
      };
      if (notes.trim()) body.notes = notes.trim();
      if (actionType === "suspension" && durationDays) body.durationDays = Number(durationDays);
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/enforcement`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to issue enforcement");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Enforcement issued", description: `${actionType} applied successfully.` });
      qc.invalidateQueries({ queryKey: ["admin-enforcement"] });
      setReason("");
      setNotes("");
      setDurationDays("");
    },
    onError: (err: unknown) => toast({
      variant: "destructive",
      title: "Could not issue enforcement",
      description: err instanceof Error ? err.message : undefined,
    }),
  });

  const verifyMutation = useMutation({
    mutationFn: async (verified: boolean) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/verification`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: verifyUserId, verified, verificationType }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to update verification");
      return res.json();
    },
    onSuccess: (_data, verified) => {
      toast({
        title: verified ? "Verification granted" : "Verification revoked",
        description: verified ? `Marked as verified ${verificationType}.` : "User is no longer verified.",
      });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
    },
    onError: (err: unknown) => toast({
      variant: "destructive",
      title: "Could not update verification",
      description: err instanceof Error ? err.message : undefined,
    }),
  });

  const liftMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/enforcement/${id}/lift`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to lift action");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action lifted", description: "The enforcement action has been reversed." });
      qc.invalidateQueries({ queryKey: ["admin-enforcement"] });
    },
    onError: (err: unknown) => toast({
      variant: "destructive",
      title: "Could not lift action",
      description: err instanceof Error ? err.message : undefined,
    }),
  });

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Member Actions</h1>
        <p className="text-muted-foreground">
          Issue tiered enforcement actions and manage member verification across Cotopia.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Enforcement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="w-4 h-4 text-primary" /> Issue Enforcement
            </CardTitle>
            <CardDescription className="text-xs">
              Warnings need moderator+, Strikes/Suspensions need admin+, Bans need master_admin. (Server enforces permissions.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">User <span className="text-red-400">*</span></label>
              <UserPicker users={directory} value={enforceUserId} onChange={setEnforceUserId} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Action Type <span className="text-red-400">*</span></label>
              <Select value={actionType} onValueChange={v => setActionType(v as ActionType)}>
                <SelectTrigger className="bg-secondary/50 border-secondary text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="strike">Strike</SelectItem>
                  <SelectItem value="suspension">Suspension</SelectItem>
                  <SelectItem value="ban">Ban</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionType === "suspension" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Duration (days)</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 7"
                  value={durationDays}
                  onChange={e => setDurationDays(e.target.value)}
                  className="bg-secondary/50 border-secondary text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Reason <span className="text-red-400">*</span></label>
              <Textarea
                placeholder="Explain why this action is being taken…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="bg-secondary/50 border-secondary text-sm min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Internal notes (optional)</label>
              <Textarea
                placeholder="Notes visible only to staff…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-secondary/50 border-secondary text-sm min-h-[60px]"
              />
            </div>
            <Button
              className="w-full gap-1.5"
              variant="destructive"
              disabled={enforceUserId === null || !reason.trim() || enforceMutation.isPending}
              onClick={() => enforceMutation.mutate()}
            >
              {enforceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              Issue {actionType}
            </Button>
          </CardContent>
        </Card>

        {/* Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="w-4 h-4 text-primary" /> Verification
            </CardTitle>
            <CardDescription className="text-xs">
              Grant or revoke verified status for artists and labels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">User <span className="text-red-400">*</span></label>
              <UserPicker users={directory} value={verifyUserId} onChange={setVerifyUserId} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Verification Type</label>
              <Select value={verificationType} onValueChange={v => setVerificationType(v as VerificationType)}>
                <SelectTrigger className="bg-secondary/50 border-secondary text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="label">Label</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                disabled={verifyUserId === null || verifyMutation.isPending}
                onClick={() => verifyMutation.mutate(true)}
              >
                {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                Grant Verification
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                disabled={verifyUserId === null || verifyMutation.isPending}
                onClick={() => verifyMutation.mutate(false)}
              >
                <ShieldOff className="w-4 h-4" />
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enforcement history */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight">Enforcement History</h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
              <p>No enforcement actions yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {history.map(a => (
                <li key={a.id} className={`flex items-start gap-4 px-4 py-3 ${a.status === "lifted" ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">@{a.username ?? `user-${a.userId}`}</span>
                      <Badge className={`border text-[10px] uppercase tracking-wide ${ACTION_BADGE[a.actionType]}`}>
                        {a.actionType}
                      </Badge>
                      {a.status === "active" ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-[10px] uppercase">Active</Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-[10px] uppercase">Lifted</Badge>
                      )}
                      {a.isAutomated && (
                        <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 border text-[10px] uppercase tracking-wide gap-1">
                          <Bot className="w-2.5 h-2.5" /> System
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm truncate" title={a.reason}>{a.reason}</p>
                    {a.notes && (
                      <p className="text-xs text-muted-foreground italic truncate" title={a.notes}>Note: {a.notes}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      {a.expiresAt && <span> · expires {format(new Date(a.expiresAt), "MMM d, yyyy")}</span>}
                    </p>
                  </div>
                  {a.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10 flex-shrink-0"
                      disabled={liftMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Lift this enforcement action? This will reverse it.")) {
                          liftMutation.mutate(a.id);
                        }
                      }}
                    >
                      <RotateCcw className="w-3 h-3" /> Lift
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
