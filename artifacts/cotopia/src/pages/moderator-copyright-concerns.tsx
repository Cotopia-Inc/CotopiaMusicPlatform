import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { AlertTriangle, Flag, Clock, CheckCircle, XCircle, Loader2, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const MOD_ROLES = ["moderator", "admin", "master_admin"];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending Review", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
  reviewed: { label: "Reviewed", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CheckCircle },
  strike_issued: { label: "Strike Issued", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle },
  dismissed: { label: "Dismissed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

export default function ModeratorCopyrightConcerns() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({ contentType: "", contentId: "", contentTitle: "", concern: "" });
  const [submitting, setSubmitting] = useState(false);
  const [concerns, setConcerns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: number; username: string; role: string }[]>([]);

  useEffect(() => {
    if (user && !MOD_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/admin/user-directory`, { headers: authHeaders() });
        if (res.ok) setUsers(await res.json());
      } catch { /* ignore */ }
    })();
  }, []);

  const loadConcerns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copyright-concerns`, { headers: authHeaders() });
      if (res.ok) setConcerns(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConcerns(); }, []);

  const handleSubmit = async () => {
    if (!form.concern.trim()) { toast({ title: "Concern description is required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { concern: form.concern.trim() };
      if (form.contentType) body.contentType = form.contentType;
      if (form.contentId) body.contentId = parseInt(form.contentId, 10);
      if (form.contentTitle.trim()) body.contentTitle = form.contentTitle.trim();

      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copyright-concerns`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Concern escalated", description: "An admin will review your escalation shortly." });
      setForm({ contentType: "", contentId: "", contentTitle: "", concern: "" });
      await loadConcerns();
    } catch {
      toast({ title: "Failed to escalate concern", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/moderator">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Flag className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">Copyright Concerns</h1>
            <p className="text-sm text-muted-foreground">Escalate copyright concerns to admins for review and final decision</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Escalate a Concern
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Flag potential copyright issues for admin review. Admins will decide whether to issue a formal copyright strike.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cc-content-type">Content Type</Label>
              <Select value={form.contentType} onValueChange={(v) => setForm(f => ({ ...f, contentType: v }))}>
                <SelectTrigger id="cc-content-type">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="song">Song</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="user">User / Profile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-user-name">User Name <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={form.contentId} onValueChange={(v) => setForm(f => ({ ...f, contentId: v }))}>
                <SelectTrigger id="cc-user-name">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concern-content-title">Content Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="concern-content-title"
                placeholder="e.g. Song or artist name"
                value={form.contentTitle}
                onChange={(e) => setForm(f => ({ ...f, contentTitle: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concern-description">Concern Description <span className="text-red-400">*</span></Label>
            <Textarea
              id="concern-description"
              placeholder="Describe the copyright concern in detail — include what content appears infringing, why you believe it's a violation, and any supporting context…"
              className="min-h-[120px]"
              value={form.concern}
              onChange={(e) => setForm(f => ({ ...f, concern: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              {submitting ? "Escalating…" : "Escalate Concern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold mb-3">My Escalations</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : concerns.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Flag className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No escalations yet. Use the form above to flag a copyright concern.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {concerns.map((c: any) => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <Card key={c.id}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.contentType && (
                            <Badge variant="outline" className="capitalize text-xs">{c.contentType}</Badge>
                          )}
                          {c.contentTitle && (
                            <span className="text-sm font-medium truncate">{c.contentTitle}</span>
                          )}
                          {c.contentUsername && (
                            <span className="text-sm text-muted-foreground">@{c.contentUsername}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{c.concern}</p>
                        {c.adminNotes && (
                          <div className="mt-2 text-xs bg-muted/50 rounded p-2 text-muted-foreground">
                            <span className="font-medium text-foreground">Admin notes:</span> {c.adminNotes}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {c.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : ""}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
