import {
  useAdminListSubmissions,
  getAdminListSubmissionsQueryKey,
  useReviewSubmission,
  type SubmissionReviewInputAction,
  type AdminListSubmissionsStatus,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, ChevronDown, ChevronUp, Music, Video,
  CheckCircle, XCircle, Clock, AlertCircle, AlertTriangle,
  ArrowUpCircle, CornerUpLeft, Scale, StickyNote, Star, Send,
} from "lucide-react";
import { CopyrightStrikeModal, type StrikeTarget } from "@/components/copyright-strike-modal";

type Mode = "moderator" | "admin" | "editor";

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
    pending_payment: { label: "Pending Payment", className: "bg-secondary text-muted-foreground" },
    paid: { label: "Paid", className: "bg-secondary text-muted-foreground" },
    pending_review: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    pending_moderator_review: { label: "Moderator Review", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    moderator_approved: { label: "Mod Approved", className: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
    moderator_rejected: { label: "Mod Rejected", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    escalated_to_admin: { label: "Escalated", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    pending_admin_final_review: { label: "Final Review", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    admin_approved: { label: "Scheduled", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    approved: { label: "Approved", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Rejected", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    published: { label: "Published", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-secondary text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] uppercase tracking-widest border ${s.className}`}>{s.label}</Badge>;
}

function AudioPreview({ url, coverUrl, title }: { url: string; coverUrl?: string | null; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-3 bg-secondary/40 rounded-xl p-3 mt-3">
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
        {coverUrl
          ? <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-muted-foreground/50" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate mb-1.5">{title}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
          >
            {playing
              ? <Pause className="w-3 h-3 text-primary-foreground fill-current" />
              : <Play className="w-3 h-3 text-primary-foreground fill-current ml-0.5" />}
          </button>
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
    </div>
  );
}

function VideoPreview({ url, coverUrl, title }: { url: string; coverUrl?: string | null; title: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="mt-3">
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full relative rounded-xl overflow-hidden group"
        >
          <div className="aspect-video bg-secondary/60 flex items-center justify-center">
            {coverUrl
              ? <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
              : <Video className="w-10 h-10 text-muted-foreground/30" />}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
              </div>
            </div>
          </div>
        </button>
      ) : (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video src={url} controls autoPlay className="w-full h-full" />
        </div>
      )}
    </div>
  );
}

interface Sub {
  id: number;
  type: string;
  title: string;
  submitterName?: string;
  userId: number;
  status: string;
  paymentStatus?: string;
  mediaUrl?: string | null;
  coverUrl?: string | null;
  adminNotes?: string | null;
  moderatorNotes?: string | null;
  submitterNotes?: string | null;
  createdAt: string;
}

const TERMINAL = ["published", "rejected", "moderator_rejected"];

function SubmissionCard({
  sub,
  mode,
  onAction,
  isPending,
}: {
  sub: Sub;
  mode: Mode;
  onAction: (id: number, action: SubmissionReviewInputAction, notes: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null);

  const isModeratorQueue = sub.status === "pending_moderator_review";
  const isTerminal = TERMINAL.includes(sub.status);
  const showModeratorActions = mode === "moderator" && isModeratorQueue;
  const showAdminActions = mode === "admin" && !isTerminal;
  const showEditorActions = mode === "editor";
  const hasActions = showModeratorActions || showAdminActions || showEditorActions;

  const fire = (action: SubmissionReviewInputAction) => onAction(sub.id, action, notes);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
          {sub.coverUrl
            ? <img src={sub.coverUrl} alt={sub.title} className="w-full h-full object-cover" />
            : sub.type === "song"
              ? <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground/50" /></div>
              : <div className="w-full h-full flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground/50" /></div>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{sub.title || <span className="text-muted-foreground italic">Untitled</span>}</span>
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border-border/60">
              {sub.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span>{sub.submitterName || `User ${sub.userId}`}</span>
            <span>·</span>
            <span>{format(new Date(sub.createdAt), 'MMM d, yyyy')}</span>
            <span>·</span>
            {statusBadge(sub.status)}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-border/60 hover:bg-secondary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Details</>}
        </Button>
      </div>

      {/* Expandable preview + notes + actions */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
          {sub.mediaUrl && sub.type === "song" && (
            <AudioPreview url={sub.mediaUrl} coverUrl={sub.coverUrl} title={sub.title} />
          )}
          {sub.mediaUrl && sub.type === "video" && (
            <VideoPreview url={sub.mediaUrl} coverUrl={sub.coverUrl} title={sub.title} />
          )}

          {sub.submitterNotes && (
            <div className="bg-secondary/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Submitter notes</p>
              <p className="text-sm break-words">{sub.submitterNotes}</p>
            </div>
          )}

          {/* Moderator notes — always visible to admins; key part of the workflow */}
          {sub.moderatorNotes && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-amber-400/80 mb-1">Moderator notes</p>
              <p className="text-sm break-words">{sub.moderatorNotes}</p>
            </div>
          )}

          {sub.adminNotes && (
            <div className="bg-secondary/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Admin/editor notes</p>
              <p className="text-sm break-words">{sub.adminNotes}</p>
            </div>
          )}

          {hasActions && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">
                  {mode === "moderator" ? "Moderator note" : mode === "editor" ? "Editorial note" : "Admin note"} (optional)
                </label>
                <Input
                  placeholder="Add a note for this submission..."
                  className="bg-secondary/50 border-secondary text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Moderator actions */}
              {showModeratorActions && (
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fire("moderator_note")} disabled={isPending}>
                    <StickyNote className="w-3.5 h-3.5" /> Add Note
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10" onClick={() => fire("escalate")} disabled={isPending}>
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => fire("moderator_reject")} disabled={isPending}>
                    <XCircle className="w-3.5 h-3.5" /> Reject Spam/Policy
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => fire("moderator_approve")} disabled={isPending}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approve for Admin
                  </Button>
                </div>
              )}

              {/* Admin actions */}
              {showAdminActions && (
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => setStrikeTarget({
                      userId: sub.userId,
                      uploaderName: sub.submitterName ?? `User ${sub.userId}`,
                      contentType: "submission",
                      contentId: sub.id,
                      contentTitle: sub.title,
                    })}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Issue Strike
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fire("admin_note")} disabled={isPending}>
                    <StickyNote className="w-3.5 h-3.5" /> Add Note
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => fire("flag_legal")} disabled={isPending}>
                    <Scale className="w-3.5 h-3.5" /> Flag Legal
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fire("return_to_moderator")} disabled={isPending}>
                    <CornerUpLeft className="w-3.5 h-3.5" /> Return to Mod
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => fire("admin_reject")} disabled={isPending}>
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => fire("admin_publish")} disabled={isPending}>
                    <CheckCircle className="w-3.5 h-3.5" /> Publish
                  </Button>
                </div>
              )}

              {/* Editor actions */}
              {showEditorActions && (
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fire("editor_note")} disabled={isPending}>
                    <StickyNote className="w-3.5 h-3.5" /> Editorial Note
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => fire("editor_recommend")} disabled={isPending}>
                    <Star className="w-3.5 h-3.5" /> Recommend
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CopyrightStrikeModal target={strikeTarget} onClose={() => setStrikeTarget(null)} />
    </div>
  );
}

type Tab = { value: AdminListSubmissionsStatus | "all"; label: string; icon: React.ElementType };

const MODERATOR_TABS: Tab[] = [
  { value: "pending_moderator_review", label: "Pending Review", icon: Clock },
  { value: "pending_admin_final_review", label: "Sent to Admin", icon: Send },
  { value: "escalated_to_admin", label: "Escalated", icon: ArrowUpCircle },
  { value: "moderator_rejected", label: "Rejected", icon: XCircle },
  { value: "all", label: "All", icon: AlertCircle },
];

const ADMIN_TABS: Tab[] = [
  { value: "pending_admin_final_review", label: "Pending Final Review", icon: Clock },
  { value: "escalated_to_admin", label: "Escalated", icon: ArrowUpCircle },
  { value: "pending_moderator_review", label: "Moderator Queue", icon: Send },
  { value: "published", label: "Published", icon: CheckCircle },
  { value: "rejected", label: "Rejected", icon: XCircle },
  { value: "all", label: "All", icon: AlertCircle },
];

const EDITOR_TABS: Tab[] = [
  { value: "published", label: "Published", icon: CheckCircle },
  { value: "pending_admin_final_review", label: "Pending", icon: Clock },
  { value: "all", label: "All", icon: AlertCircle },
];

const ACTION_TOAST: Record<SubmissionReviewInputAction, string> = {
  moderator_approve: "Approved for admin review",
  moderator_reject: "Submission rejected",
  escalate: "Escalated to admin",
  moderator_note: "Moderator note saved",
  admin_publish: "Submission published",
  admin_reject: "Submission rejected",
  return_to_moderator: "Returned to moderator",
  flag_legal: "Legal concern flagged",
  admin_note: "Admin note saved",
  editor_recommend: "Recommendation recorded",
  editor_note: "Editorial note saved",
};

export default function AdminSubmissions() {
  const { user } = useAuth();
  const mode: Mode = user?.role === "moderator" ? "moderator" : user?.role === "editor" ? "editor" : "admin";
  const tabs = mode === "moderator" ? MODERATOR_TABS : mode === "editor" ? EDITOR_TABS : ADMIN_TABS;

  const [statusFilter, setStatusFilter] = useState<AdminListSubmissionsStatus | "all">(tabs[0].value);

  const queryParams = { status: statusFilter !== "all" ? statusFilter : undefined };
  const { data, isLoading } = useAdminListSubmissions(
    queryParams,
    { query: { queryKey: getAdminListSubmissionsQueryKey(queryParams) } }
  );

  const reviewMutation = useReviewSubmission();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAction = (id: number, action: SubmissionReviewInputAction, notes: string) => {
    reviewMutation.mutate(
      { id, data: { action, notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: ACTION_TOAST[action] });
          queryClient.invalidateQueries({ queryKey: ["adminListSubmissions"] });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Action failed";
          toast({ title: "Action failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const heading = mode === "moderator"
    ? { tag: "Moderator", title: "Review Submissions", desc: "Approve for admin review, reject spam, or escalate. Moderators cannot publish content." }
    : mode === "editor"
      ? { tag: "Editor", title: "Editorial Review", desc: "Recommend content for featured placement and leave editorial notes." }
      : { tag: "Admin", title: "Final Review", desc: "Publish, reject, return to moderator, or flag legal concerns." };

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{heading.tag}</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">{heading.title}</h1>
        <p className="text-muted-foreground">{heading.desc}</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              statusFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {data && (
          <span className="flex items-center px-3 py-2 text-xs text-muted-foreground">
            {data.length} result{data.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))
        ) : data?.length ? (
          data.map((sub) => (
            <SubmissionCard
              key={sub.id}
              sub={sub as Sub}
              mode={mode}
              onAction={handleAction}
              isPending={reviewMutation.isPending}
            />
          ))
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-border">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="w-12 h-12 text-muted-foreground/20" />
              <p className="font-medium">Nothing here right now</p>
              <p className="text-xs">No submissions match this filter.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
