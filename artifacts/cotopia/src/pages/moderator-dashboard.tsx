import { useAdminListSubmissions } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import {
  ShieldCheck, FileText, MessageSquare, MessageCircle, Flag,
  ArrowRight, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

const MOD_ROLES = ["moderator", "admin", "master_admin"];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cotopia_token")}`,
  "Content-Type": "application/json",
});

export default function ModeratorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [pendingConcerns, setPendingConcerns] = useState<number | null>(null);

  useEffect(() => {
    if (user && !MOD_ROLES.includes(user.role)) navigate("/");
  }, [user, navigate]);

  const { data: pendingSubmissions } = useAdminListSubmissions({ status: "pending_review" });
  const pending = Array.isArray(pendingSubmissions) ? pendingSubmissions : [];
  const pendingCount = pending.length;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/admin/copyright-concerns?status=pending`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setPendingConcerns(Array.isArray(data) ? data.length : 0);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const actions = [
    { href: "/moderator/submissions", icon: FileText, color: "text-amber-400", border: "hover:border-amber-400/40", title: "Review Submissions", desc: "Flag or escalate policy-violating content" },
    { href: "/moderator/comments", icon: MessageSquare, color: "text-primary", border: "hover:border-primary/50", title: "Moderate Comments", desc: "Hide or remove flagged comments" },
    { href: "/moderator/messages", icon: MessageCircle, color: "text-blue-400", border: "hover:border-blue-400/40", title: "DM Feed", desc: "Monitor and moderate direct messages" },
    { href: "/moderator/copyright-concerns", icon: Flag, color: "text-amber-400", border: "hover:border-amber-400/40", title: "Copyright Concerns", desc: "Escalate copyright issues to admins" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Moderator Dashboard</h1>
          <p className="text-sm text-muted-foreground">Keep Everyday Radio safe and on-policy</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Submissions</p>
                <p className="text-2xl font-bold mt-1">{pendingCount}</p>
              </div>
              <FileText className="w-8 h-8 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Pending Concerns</p>
                <p className="text-2xl font-bold mt-1">{pendingConcerns ?? "—"}</p>
              </div>
              <Flag className="w-8 h-8 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Moderation Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href} href={a.href}>
                <Card className={`cursor-pointer transition-colors h-full ${a.border}`}>
                  <CardContent className="pt-5 pb-5">
                    <Icon className={`w-5 h-5 mb-2 ${a.color}`} />
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Awaiting Review</h2>
          <Link href="/moderator/submissions">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {pendingCount === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center px-6">
                <ShieldCheck className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pending.slice(0, 6).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title ?? `Submission #${s.id}`}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.type ?? "content"} · pending review</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {s.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
