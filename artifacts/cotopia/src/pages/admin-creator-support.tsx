import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminCreatorSupportOverview,
  getGetAdminCreatorSupportOverviewQueryKey,
  useUpdateSupportTransactionStatus,
  useUpdateSupportWallModeration,
} from "@workspace/api-client-react";
import type { SupportActivityItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  DollarSign,
  Users,
  Activity,
  ShieldCheck,
  MessageCircleHeart,
  Check,
  EyeOff,
  RotateCcw,
  Loader2,
  Music,
  Video,
  Crown,
} from "lucide-react";
import { format } from "date-fns";

const MODERATION_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending Review", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  hidden: { label: "Hidden", className: "bg-secondary text-muted-foreground border-border" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelled", className: "bg-secondary text-muted-foreground border-border" },
};

export default function AdminCreatorSupport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "moderation" | "transactions">("overview");

  const { data: overview, isLoading } = useGetAdminCreatorSupportOverview({
    query: { queryKey: getGetAdminCreatorSupportOverviewQueryKey() },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetAdminCreatorSupportOverviewQueryKey() });

  const moderationMutation = useUpdateSupportWallModeration({
    mutation: {
      onSuccess: (_data, variables) => {
        toast({ title: `Message ${variables.data.action === "approve" ? "approved" : variables.data.action === "hide" ? "hidden" : "restored"}.` });
        invalidate();
      },
      onError: (e: any) => toast({ variant: "destructive", title: e?.data?.error ?? "Failed to update message" }),
    },
  });

  const statusMutation = useUpdateSupportTransactionStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transaction status updated." });
        invalidate();
      },
      onError: (e: any) => toast({ variant: "destructive", title: e?.data?.error ?? "Failed to update transaction" }),
    },
  });

  const statCards = [
    { title: "Support Attempts", value: overview?.totalSupportAttempts, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
    { title: "Demo Transactions", value: overview?.totalDemoTransactions, icon: Heart, color: "text-pink-400", bg: "bg-pink-500/10" },
    { title: "Total Demo Amount", value: overview ? `$${overview.totalDemoAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10", raw: true },
    { title: "New Followers (30d)", value: overview?.newFollowers30d, icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
    { title: "Pending Moderation", value: overview?.pendingModerationCount, icon: MessageCircleHeart, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  const pendingMessages = (overview?.recentMessages ?? []).filter(m => m.moderationStatus === "pending");
  const otherMessages = (overview?.recentMessages ?? []).filter(m => m.moderationStatus !== "pending");

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
            <Heart className="w-7 h-7 text-pink-500" /> Creator Support
          </h1>
          <p className="text-muted-foreground">Universal Creator Support System — platform overview, moderation, and demo transaction management.</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide">
            Demo Mode — {overview?.systemHealth === "operational" ? "Operational" : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`p-1.5 rounded-md ${card.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <div className="text-2xl font-bold">
                    {card.raw ? (card.value ?? "$0.00") : (typeof card.value === "number" ? card.value.toLocaleString() : card.value ?? 0)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
        {([
          { id: "overview" as const, label: "Overview", icon: Crown },
          { id: "moderation" as const, label: "Wall Moderation", icon: MessageCircleHeart, badge: pendingMessages.length },
          { id: "transactions" as const, label: "Transactions", icon: Activity },
        ]).map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {!!badge && <Badge className="bg-amber-500/20 text-amber-400 border-none text-[10px] h-4 px-1.5 ml-0.5">{badge}</Badge>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" /> Most Supported Creators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : overview?.mostSupportedCreators?.length ? (
                  overview.mostSupportedCreators.map((c, i) => (
                    <div key={c.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-muted-foreground text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                        <p className="font-semibold text-sm truncate">{c.displayName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">${c.totalAmount.toFixed(2)}</p>
                        <p className="text-[11px] text-muted-foreground">{c.tipCount} tip{c.tipCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Music className="w-4 h-4 text-purple-400" /> Most Supported Songs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : overview?.mostSupportedSongs?.length ? (
                  overview.mostSupportedSongs.map((s, i) => (
                    <div key={`${s.contentType}-${s.contentId}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-muted-foreground text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                        <p className="font-semibold text-sm truncate">{s.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">${s.totalAmount.toFixed(2)}</p>
                        <p className="text-[11px] text-muted-foreground">{s.tipCount} tip{s.tipCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Video className="w-4 h-4 text-pink-400" /> Most Supported Videos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                ) : overview?.mostSupportedVideos?.length ? (
                  overview.mostSupportedVideos.map((v, i) => (
                    <div key={`${v.contentType}-${v.contentId}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-muted-foreground text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                        <p className="font-semibold text-sm truncate">{v.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">${v.totalAmount.toFixed(2)}</p>
                        <p className="text-[11px] text-muted-foreground">{v.tipCount} tip{v.tipCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Top Supporters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : overview?.topSupporters?.length ? (
                overview.topSupporters.map((s, i) => (
                  <div key={s.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-bold text-muted-foreground text-sm w-5 text-center flex-shrink-0">{i + 1}</span>
                      <p className="font-semibold text-sm truncate">{s.displayName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">${s.totalAmount.toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">{s.tipCount} tip{s.tipCount === 1 ? "" : "s"} sent</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">No data yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "moderation" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Pending Approval ({pendingMessages.length})
            </h2>
            {isLoading ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
            ) : pendingMessages.length ? (
              <div className="space-y-3">
                {pendingMessages.map(m => (
                  <MessageRow
                    key={m.id}
                    item={m}
                    onApprove={() => moderationMutation.mutate({ id: m.id, data: { action: "approve" } })}
                    onHide={() => moderationMutation.mutate({ id: m.id, data: { action: "hide" } })}
                    pending={moderationMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6 text-center bg-card border border-border border-dashed rounded-xl">
                No messages awaiting moderation.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Recent Messages</h2>
            {isLoading ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
            ) : otherMessages.length ? (
              <div className="space-y-3">
                {otherMessages.map(m => (
                  <MessageRow
                    key={m.id}
                    item={m}
                    onApprove={() => moderationMutation.mutate({ id: m.id, data: { action: "approve" } })}
                    onHide={() => moderationMutation.mutate({ id: m.id, data: { action: "hide" } })}
                    onRestore={() => moderationMutation.mutate({ id: m.id, data: { action: "restore" } })}
                    pending={moderationMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6 text-center bg-card border border-border border-dashed rounded-xl">
                No support wall messages yet.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Recent Transactions</h2>
          {isLoading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : overview?.recentTransactions?.length ? (
            <div className="space-y-3">
              {overview.recentTransactions.map(t => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{t.supporterDisplayName}</p>
                      <span className="text-xs text-muted-foreground">→</span>
                      <p className="text-sm truncate">{t.contentTitle ?? `${t.contentType} #${t.contentId}`}</p>
                      <Badge className={`${STATUS_META[t.status]?.className ?? ""} border text-[10px] uppercase`}>
                        {STATUS_META[t.status]?.label ?? t.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t.transactionRef} · {format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-sm">${t.amount.toFixed(2)}</span>
                    <select
                      value={t.status}
                      disabled={statusMutation.isPending}
                      onChange={e => statusMutation.mutate({ id: t.id, data: { status: e.target.value as "completed" | "failed" | "cancelled" } })}
                      className="h-8 rounded-md border border-secondary bg-secondary/50 px-2 text-xs text-foreground"
                    >
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-6 text-center bg-card border border-border border-dashed rounded-xl">
              No transactions yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({
  item,
  onApprove,
  onHide,
  onRestore,
  pending,
}: {
  item: SupportActivityItem;
  onApprove: () => void;
  onHide: () => void;
  onRestore?: () => void;
  pending: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-semibold text-sm">{item.supporterDisplayName}</p>
          <span className="text-xs text-muted-foreground">supported</span>
          <p className="text-sm truncate">{item.contentTitle ?? `${item.contentType} #${item.contentId}`}</p>
          <Badge className={`${MODERATION_META[item.moderationStatus]?.className ?? ""} border text-[10px] uppercase`}>
            {MODERATION_META[item.moderationStatus]?.label ?? item.moderationStatus}
          </Badge>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.messageVisibility}</span>
        </div>
        {item.message && <p className="text-sm text-muted-foreground italic">"{item.message}"</p>}
        <p className="text-[11px] text-muted-foreground mt-1">${item.amount.toFixed(2)} · {format(new Date(item.createdAt), "MMM d, yyyy HH:mm")}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.moderationStatus !== "approved" && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={pending} onClick={onApprove}>
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Approve
          </Button>
        )}
        {item.moderationStatus !== "hidden" && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={pending} onClick={onHide}>
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
            Hide
          </Button>
        )}
        {item.moderationStatus === "hidden" && onRestore && (
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={pending} onClick={onRestore}>
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Restore
          </Button>
        )}
      </div>
    </div>
  );
}
