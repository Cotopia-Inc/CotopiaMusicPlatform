import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Flag, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RoleBadges } from "@/components/role-badges";
import { formatDistanceToNow } from "date-fns";

const ADMIN_ROLES = ["admin", "master_admin"];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
  reviewed: { label: "Reviewed", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CheckCircle },
  strike_issued: { label: "Strike Issued", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: ShieldOff },
  dismissed: { label: "Dismissed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

export default function AdminCopyrightConcerns() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [concerns, setConcerns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (user && !ADMIN_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const loadConcerns = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copyright-concerns${params}`, { headers: authHeaders() });
      if (res.ok) setConcerns(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConcerns(); }, [statusFilter]);

  const resolve = async (id: number, action: "dismissed" | "strike_issued", strikeReason?: string) => {
    setResolving(id);
    try {
      const body: Record<string, unknown> = {
        status: action,
        adminNotes: adminNotes[id] ?? "",
      };
      if (action === "strike_issued" && strikeReason) {
        body.issueStrike = true;
        body.strikeReason = strikeReason;
      }
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copyright-concerns/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const label = action === "strike_issued" ? "Strike issued and concern resolved" : "Concern dismissed";
      toast({ title: label });
      await loadConcerns();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flag className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">Copyright Concerns</h1>
            <p className="text-sm text-muted-foreground">Review moderator-escalated copyright concerns and decide on final action</p>
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="strike_issued">Strike Issued</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : concerns.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Flag className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "pending" ? "No pending concerns — moderators haven't escalated anything yet." : "No concerns found."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {concerns.map((c: any) => {
            const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isPending = c.status === "pending";
            return (
              <Card key={c.id} className={isPending ? "border-amber-500/20" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm">Concern #{c.id}</CardTitle>
                        {c.contentType && <Badge variant="outline" className="capitalize text-xs">{c.contentType}</Badge>}
                        {c.contentUsername && <span className="text-xs text-muted-foreground">@{c.contentUsername}</span>}
                        {c.contentTitle && <span className="text-xs font-medium">"{c.contentTitle}"</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Escalated by <span className="font-medium text-foreground inline-flex items-center gap-0.5">{c.reporterUsername ?? `User #${c.reporterId}`}<RoleBadges role={c.reporterRole} isVerified={false} /></span>
                        {" · "}{c.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <Badge className={`text-xs border flex items-center gap-1 ${cfg.color}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-sm leading-relaxed">{c.concern}</p>
                  </div>

                  {c.adminNotes && !isPending && (
                    <div className="text-xs bg-blue-500/5 border border-blue-500/20 rounded p-2.5 text-muted-foreground">
                      <span className="font-medium text-foreground">Admin notes:</span> {c.adminNotes}
                      {c.reviewerUsername && <span className="ml-1 inline-flex items-center gap-0.5">— {c.reviewerUsername}<RoleBadges role={c.reviewerRole} isVerified={false} /></span>}
                    </div>
                  )}

                  {isPending && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Admin Notes (optional)</Label>
                        <Textarea
                          placeholder="Add internal notes for this decision…"
                          className="min-h-[70px] text-sm"
                          value={adminNotes[c.id] ?? ""}
                          onChange={(e) => setAdminNotes(n => ({ ...n, [c.id]: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resolving === c.id}
                          onClick={() => resolve(c.id, "dismissed")}
                        >
                          {resolving === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={resolving === c.id}
                          onClick={() => {
                            const reason = (adminNotes[c.id] ?? "").trim() || "Copyright violation escalated by moderator";
                            resolve(c.id, "strike_issued", reason);
                          }}
                        >
                          {resolving === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          Issue Strike
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
