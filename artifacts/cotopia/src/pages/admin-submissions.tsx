import { useAdminListSubmissions, getAdminListSubmissionsQueryKey, useUpdateSubmission } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, ChevronDown, ChevronUp, Music, Video,
  CheckCircle, XCircle, Clock, AlertCircle
} from "lucide-react";
import type { AdminListSubmissionsStatus } from "@workspace/api-client-react";

type SubmissionStatus = "approved" | "rejected" | "pending_review" | "draft" | "published";

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending_review: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Approved", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Rejected", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    published: { label: "Published", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
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
          <video
            src={url}
            controls
            autoPlay
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  sub,
  onApprove,
  onReject,
  isPending,
}: {
  sub: {
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
    submitterNotes?: string | null;
    createdAt: string;
  };
  onApprove: (id: number, notes: string) => void;
  onReject: (id: number, notes: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(sub.adminNotes ?? "");

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Cover thumbnail */}
        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
          {sub.coverUrl
            ? <img src={sub.coverUrl} alt={sub.title} className="w-full h-full object-cover" />
            : sub.type === "song"
              ? <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground/50" /></div>
              : <div className="w-full h-full flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground/50" /></div>}
        </div>

        {/* Info */}
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

        {/* Preview toggle */}
        {sub.mediaUrl && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-border/60 hover:bg-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Preview</>}
          </Button>
        )}

        {/* Quick actions */}
        {sub.status === "pending_review" && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onReject(sub.id, notes)}
              disabled={isPending}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onApprove(sub.id, notes)}
              disabled={isPending}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Expandable preview + notes */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
          {/* Media player */}
          {sub.mediaUrl && sub.type === "song" && (
            <AudioPreview url={sub.mediaUrl} coverUrl={sub.coverUrl} title={sub.title} />
          )}
          {sub.mediaUrl && sub.type === "video" && (
            <VideoPreview url={sub.mediaUrl} coverUrl={sub.coverUrl} title={sub.title} />
          )}

          {/* Submitter notes */}
          {sub.submitterNotes && (
            <div className="bg-secondary/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Submitter notes</p>
              <p className="text-sm">{sub.submitterNotes}</p>
            </div>
          )}

          {/* Admin notes + actions */}
          {sub.status === "pending_review" && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Admin notes (optional)
                </label>
                <Input
                  placeholder="Add feedback for the submitter..."
                  className="bg-secondary/50 border-secondary text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onReject(sub.id, notes)}
                  disabled={isPending}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onApprove(sub.id, notes)}
                  disabled={isPending}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSubmissions() {
  const [statusFilter, setStatusFilter] = useState<AdminListSubmissionsStatus | "all">("pending_review");

  const { data, isLoading } = useAdminListSubmissions(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getAdminListSubmissionsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const updateMutation = useUpdateSubmission();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) });
  };

  const handleApprove = (id: number, notes: string) => {
    updateMutation.mutate({ id, data: { status: "approved", adminNotes: notes || undefined } }, {
      onSuccess: () => { toast({ title: "Submission approved" }); invalidate(); },
    });
  };

  const handleReject = (id: number, notes: string) => {
    updateMutation.mutate({ id, data: { status: "rejected", adminNotes: notes || undefined } }, {
      onSuccess: () => { toast({ title: "Submission rejected" }); invalidate(); },
    });
  };

  const tabs: Array<{ value: AdminListSubmissionsStatus | "all"; label: string; icon: React.ElementType }> = [
    { value: "pending_review", label: "Pending", icon: Clock },
    { value: "approved", label: "Approved", icon: CheckCircle },
    { value: "rejected", label: "Rejected", icon: XCircle },
    { value: "all", label: "All", icon: AlertCircle },
  ];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin</p>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Review Submissions</h1>
        <p className="text-muted-foreground">
          Preview each track or video before deciding to approve or reject.
        </p>
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
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))
        ) : data?.length ? (
          data.map((sub) => (
            <SubmissionCard
              key={sub.id}
              sub={sub}
              onApprove={handleApprove}
              onReject={handleReject}
              isPending={updateMutation.isPending}
            />
          ))
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-border">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="w-12 h-12 text-muted-foreground/20" />
              <p className="font-medium">No {statusFilter === "all" ? "" : statusFilter.replace("_", " ")} submissions</p>
              <p className="text-xs">Nothing to review right now.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
