import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubmissions, getListSubmissionsQueryKey, useGetCreatorSupportDashboard,
  useGetCreatorPendingWallMessages, useApproveSupportWallMessage, useHideSupportWallMessage,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { CheckCircle2, Circle, Clock, Music, Video, XCircle, Send, Lightbulb, Bug, Star, Heart, MessageCircleHeart, UserPlus, Settings, Trash2, ThumbsUp, Globe, EyeOff, Lock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { ExperienceFeedbackModal } from "@/components/experience-feedback-modal";
import { useToast } from "@/hooks/use-toast";

const VISIBILITY_BADGE: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  public:    { icon: Globe,   label: "Public",    className: "text-green-400 bg-green-400/10" },
  anonymous: { icon: EyeOff, label: "Anonymous", className: "text-amber-400 bg-amber-400/10" },
  private:   { icon: Lock,   label: "Private",   className: "text-muted-foreground bg-muted" },
};

function VisibilityBadge({ visibility }: { visibility: string }) {
  const meta = VISIBILITY_BADGE[visibility];
  const Icon = meta?.icon ?? Globe;
  const label = meta?.label ?? visibility.replace(/_/g, " ");
  const cls = meta?.className ?? "text-muted-foreground bg-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] capitalize px-1.5 py-0.5 rounded ${cls}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

const STEPS = ["Received", "In Review", "Approved", "Scheduled", "Published"] as const;

function statusToStep(status: string): number {
  switch (status) {
    case "draft": return 0;
    case "pending_review":
    case "pending_moderator_review":
    case "moderator_approved":
    case "escalated_to_admin":
    case "pending_admin_final_review": return 1;
    case "approved": return 2;
    case "admin_approved": return 3;
    case "published": return 4;
    default: return 0;
  }
}

function Pipeline({ step }: { step: number }) {
  return (
    <div className="flex items-start">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              i < step
                ? "bg-green-500 text-white"
                : i === step
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-secondary text-muted-foreground"
            }`}>
              {i < step ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : i === step ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5 opacity-30" />
              )}
            </div>
            <p className={`text-[9px] font-semibold text-center leading-tight w-14 ${
              i < step ? "text-green-500" : i === step ? "text-primary" : "text-muted-foreground/40"
            }`}>{label}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mt-3.5 mx-1 rounded ${i < step ? "bg-green-500" : "bg-secondary"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function CreatorDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListSubmissions({
    query: { queryKey: getListSubmissionsQueryKey() },
  });
  const { data: supportDashboard } = useGetCreatorSupportDashboard({
    query: { queryKey: ["getCreatorSupportDashboard"] },
  });
  const { data: pendingWall } = useGetCreatorPendingWallMessages(
    { page: 1, pageSize: 20 },
    { query: { queryKey: ["getCreatorPendingWallMessages"], enabled: (supportDashboard?.pendingWallApprovalCount ?? 0) > 0 } },
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const invalidatePending = () => {
    queryClient.invalidateQueries({ queryKey: ["getCreatorPendingWallMessages"] });
    queryClient.invalidateQueries({ queryKey: ["getCreatorSupportDashboard"] });
  };

  const approveMutation = useApproveSupportWallMessage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Message approved and now visible on your wall" });
        invalidatePending();
      },
      onError: () => toast({ variant: "destructive", title: "Could not approve message" }),
    },
  });

  const deleteMutation = useHideSupportWallMessage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Message removed" });
        invalidatePending();
      },
      onError: () => toast({ variant: "destructive", title: "Could not remove message" }),
    },
  });

  const submissions = data ?? [];
  const REJECTED_STATUSES = ["rejected", "moderator_rejected"];
  const active = submissions.filter(s => !REJECTED_STATUSES.includes(s.status));
  const rejected = submissions.filter(s => REJECTED_STATUSES.includes(s.status));
  const published = submissions.filter(s => s.status === "published");
  const inProgress = active.filter(s => s.status !== "published");

  return (
    <div className="space-y-8 pb-24 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Creator Dashboard</h1>
          <p className="text-muted-foreground">Track your submissions through the review process.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Star className="w-3.5 h-3.5 text-amber-400" />
            Rate Experience
          </button>
          <Link href="/suggest-feature">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Lightbulb className="w-3.5 h-3.5 text-violet-400" />
              Suggest a Feature
            </button>
          </Link>
          <Link href="/report-bug">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Bug className="w-3.5 h-3.5 text-red-400" />
              Report a Bug
            </button>
          </Link>
        </div>
        <ExperienceFeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} trigger="manual" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-3xl font-extrabold">{isLoading ? "—" : submissions.length}</p>
          <p className="text-sm text-muted-foreground mt-0.5">Total Submitted</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-3xl font-extrabold text-green-500">{isLoading ? "—" : published.length}</p>
          <p className="text-sm text-muted-foreground mt-0.5">Published</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-3xl font-extrabold text-yellow-500">{isLoading ? "—" : inProgress.length}</p>
          <p className="text-sm text-muted-foreground mt-0.5">In Progress</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" /> Creator Support
            <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">Beta Tip Testing</Badge>
          </h2>
          <Link href="/profile">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Manage Settings
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-2xl font-extrabold">{supportDashboard ? supportDashboard.supporterCount.toLocaleString() : "—"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Supporters</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-2xl font-extrabold">{supportDashboard ? supportDashboard.totalDemoTips.toLocaleString() : "—"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Demo Tips Received</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-2xl font-extrabold">{supportDashboard ? `$${supportDashboard.totalDemoAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Total Amount (Demo)</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-2xl font-extrabold">{supportDashboard ? `+${supportDashboard.newFollowers30d.toLocaleString()}` : "—"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">New Followers (30d)</p>
          </div>
        </div>

        {supportDashboard && supportDashboard.pendingWallApprovalCount > 0 && (
          <div className="bg-card rounded-xl border border-amber-500/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircleHeart className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {supportDashboard.pendingWallApprovalCount} support wall {supportDashboard.pendingWallApprovalCount === 1 ? "message needs" : "messages need"} your approval
              </p>
            </div>

            {pendingWall && pendingWall.items.length > 0 && (
              <div className="space-y-2">
                {pendingWall.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{item.supporterDisplayName ?? "Anonymous Supporter"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                        {item.contentTitle && (
                          <span className="text-xs text-muted-foreground/70">· on {item.contentTitle}</span>
                        )}
                      </div>
                      {item.message && (
                        <p className="text-sm text-muted-foreground break-words">"{item.message}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        disabled={approveMutation.isPending || deleteMutation.isPending}
                        onClick={() => approveMutation.mutate({ transactionId: item.id })}
                        title="Approve — show on your wall"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={approveMutation.isPending || deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate({ transactionId: item.id })}
                        title="Delete this message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {supportDashboard && supportDashboard.recentActivity.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Activity</p>
            <div className="space-y-3">
              {supportDashboard.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <UserPlus className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {activity.supporterDisplayName} supported {activity.contentTitle ?? "you"}
                      </p>
                      {activity.message && activity.messageVisibility !== "private" && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">"{activity.message}"</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground">{format(new Date(activity.createdAt), "MMM d, yyyy")}</p>
                        <VisibilityBadge visibility={activity.messageVisibility} />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0">${activity.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {supportDashboard && supportDashboard.supportButtonClicks === 0 && supportDashboard.supporterCount === 0 && (
          <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
            <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold">No support activity yet</p>
            <p className="text-xs mt-1">Enable Creator Support in your profile settings to start receiving demo tips.</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : active.length === 0 && rejected.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Music className="w-14 h-14 mx-auto mb-5 opacity-20" />
          <p className="text-xl font-semibold">No submissions yet</p>
          <p className="text-sm mt-1.5">Head to Music Review to submit your first track.</p>
          <Link href="/submit">
            <button className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              <Send className="w-4 h-4" />Music Review
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map(sub => {
            const step = statusToStep(sub.status);
            return (
              <div key={sub.id} className="bg-card rounded-xl border border-border p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {sub.type === "video"
                      ? <Video className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      : <Music className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="font-semibold leading-tight">{sub.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Submitted {format(new Date(sub.createdAt), "MMM d, yyyy")}
                        {" · "}
                        <span className="capitalize">{sub.type}</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    step === 4
                      ? "bg-green-500/10 text-green-500 border-green-500/20 flex-shrink-0"
                      : step >= 2
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 flex-shrink-0"
                        : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 flex-shrink-0"
                  }>
                    {STEPS[step]}
                  </Badge>
                </div>

                <Pipeline step={step} />

                {sub.adminNotes && (
                  <div className="text-xs bg-secondary/50 rounded-lg px-3 py-2.5 border border-border/50 text-muted-foreground">
                    <span className="font-semibold text-foreground">Staff note: </span>{sub.adminNotes}
                  </div>
                )}
              </div>
            );
          })}

          {rejected.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Not Approved</p>
              {rejected.map(sub => (
                <div key={sub.id} className="bg-card rounded-xl border border-red-500/20 p-5 space-y-3 opacity-80">
                  <div className="flex items-center gap-2.5">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{sub.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sub.createdAt), "MMM d, yyyy")} · <span className="capitalize">{sub.type}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 flex-shrink-0">
                      Not Approved
                    </Badge>
                  </div>
                  {sub.adminNotes && (
                    <div className="text-xs bg-red-500/5 rounded-lg px-3 py-2.5 border border-red-500/10 text-muted-foreground">
                      <span className="font-semibold text-foreground">Feedback: </span>{sub.adminNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
