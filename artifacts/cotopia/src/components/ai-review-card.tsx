/**
 * AI Authorship Review card — shown to moderators and admins on submission detail pages.
 *
 * Displays:
 * - Creator-declared creation method
 * - Estimated AI likelihood meter (0-100%) when available
 * - Detection confidence, risk level, indicators
 * - Advisory disclaimer (always shown)
 * - Admin controls: assign tag, lock/unlock, escalate, request evidence
 *
 * IMPORTANT: All detection scores are advisory estimates only. They must be
 * evaluated together with creator disclosures, project evidence, human review,
 * and platform policy. Never describe results as conclusive proof.
 */
import { useState } from "react";
import { AlertTriangle, Lock, LockOpen, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CreationMethod } from "@/components/ai-origin-badge";

interface AiReviewData {
  creationMethod: CreationMethod;
  creatorSelectedTag?: string | null;
  platformAssignedTag?: string | null;
  effectiveDisplayTag?: string | null;
  tagSource?: string | null;
  tagLocked?: boolean;
  aiEstimatePercent?: number | null;
  aiConfidenceLevel?: string | null;
  aiRiskLevel?: string | null;
  aiDetectionReasons?: string[] | null;
  aiReviewStatus?: string | null;
  aiReviewedAt?: string | null;
  aiOverrideReason?: string | null;
  appealStatus?: string | null;
}

interface AiReviewCardProps {
  contentType: "song" | "video";
  contentId: number;
  data: AiReviewData;
  isAdmin: boolean;
  isModerator?: boolean;
  onAction?: (action: string, params?: Record<string, unknown>) => void | Promise<void>;
  onScanRequest?: () => void | Promise<void>;
  aiLowThreshold?: number;
  aiHighThreshold?: number;
  aiCriticalThreshold?: number;
}

const CREATION_METHOD_LABELS: Record<string, string> = {
  unclassified: "Unclassified",
  human_created: "Human Created",
  ai_assisted: "AI Assisted",
  hybrid_human_ai: "Hybrid Human + AI",
  fully_ai_generated: "Fully AI Generated",
  disputed: "Disputed",
  under_review: "Under Review",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  not_scanned: "Not Scanned",
  scan_pending: "Scan Pending",
  scan_complete: "Scan Complete",
  moderator_review: "Moderator Review",
  escalated_to_admin: "Escalated to Admin",
  evidence_requested: "Evidence Requested",
  admin_approved: "Admin Approved",
  admin_rejected: "Admin Rejected",
  auto_rejected: "Auto-Rejected",
  appealed: "Appealed",
  appeal_resolved: "Appeal Resolved",
};

function RiskBar({
  percent,
  low = 25,
  high = 60,
  critical = 90,
}: {
  percent: number;
  low?: number;
  high?: number;
  critical?: number;
}) {
  const color =
    percent < low
      ? "bg-emerald-500"
      : percent < high
      ? "bg-amber-400"
      : percent < critical
      ? "bg-orange-500"
      : "bg-red-600";

  const riskLabel =
    percent < low ? "Low" : percent < high ? "Moderate" : percent < critical ? "High" : "Critical";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Estimated AI likelihood</span>
        <span className="font-medium tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Estimated AI likelihood: ${percent}%`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0% — Low</span>
        <span className={cn("font-semibold",
          percent < low ? "text-emerald-600 dark:text-emerald-400" :
          percent < high ? "text-amber-600 dark:text-amber-400" :
          percent < critical ? "text-orange-600 dark:text-orange-400" :
          "text-red-600 dark:text-red-400"
        )}>
          {riskLabel} Risk
        </span>
        <span>100% — Critical</span>
      </div>
    </div>
  );
}

const ADMIN_ACTIONS = [
  { value: "assign_tag", label: "Assign Platform Tag" },
  { value: "lock", label: "Lock Classification" },
  { value: "unlock", label: "Unlock Classification" },
  { value: "escalate", label: "Escalate to Admin" },
  { value: "request_evidence", label: "Request Evidence" },
  { value: "approve", label: "Mark Admin Approved" },
  { value: "reject", label: "Reject (AI Policy)" },
] as const;

const TAG_OPTIONS = [
  { value: "human_created", label: "Human Created" },
  { value: "ai_assisted", label: "AI Assisted" },
  { value: "hybrid_human_ai", label: "Hybrid Human + AI" },
  { value: "fully_ai_generated", label: "Fully AI Generated" },
  { value: "disputed", label: "Disputed" },
  { value: "under_review", label: "Under Review" },
] as const;

const MOD_ACTIONS = [
  { value: "flag", label: "Flag for Admin Review" },
  { value: "escalate", label: "Escalate to Admin" },
] as const;

export function AiReviewCard({
  contentType,
  contentId,
  data,
  isAdmin,
  isModerator = false,
  onAction,
  onScanRequest,
  aiLowThreshold = 25,
  aiHighThreshold = 60,
  aiCriticalThreshold = 90,
}: AiReviewCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [reason, setReason] = useState("");

  const hasScore = typeof data.aiEstimatePercent === "number" && data.aiEstimatePercent !== null;

  async function handleAction() {
    if (!selectedAction || !onAction) return;
    setActionLoading(true);
    try {
      await onAction(selectedAction, {
        platformAssignedTag: selectedTag || undefined,
        aiOverrideReason: reason || undefined,
      });
      setSelectedAction("");
      setSelectedTag("");
      setReason("");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        onClick={() => setExpanded((e) => !e)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          AI Authorship Review
          {data.tagLocked && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest border-amber-500/50 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 ml-1">
              Locked
            </Badge>
          )}
          {data.aiReviewStatus && data.aiReviewStatus !== "not_scanned" && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 ml-1">
              {REVIEW_STATUS_LABELS[data.aiReviewStatus] ?? data.aiReviewStatus}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Advisory disclaimer — always visible to staff */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Automated AI-detection results are advisory estimates and may be inaccurate. They must be
              evaluated together with creator disclosures, project evidence, human review, and platform policy.
            </p>
          </div>

          {/* Creator declaration */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Creator Declared</div>
            <div className="text-sm font-semibold">
              {CREATION_METHOD_LABELS[data.creatorSelectedTag ?? data.creationMethod] ?? data.creationMethod}
            </div>
            {data.platformAssignedTag && (
              <div className="flex items-center gap-1.5 mt-1">
                <Lock className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-muted-foreground">
                  Platform assigned: <strong>{CREATION_METHOD_LABELS[data.platformAssignedTag]}</strong>
                </span>
              </div>
            )}
          </div>

          {/* AI likelihood meter */}
          {hasScore ? (
            <RiskBar
              percent={data.aiEstimatePercent!}
              low={aiLowThreshold}
              high={aiHighThreshold}
              critical={aiCriticalThreshold}
            />
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Detection unavailable — no provider result. Do not generate or assume a score.
            </div>
          )}

          {/* Detection metadata */}
          {(data.aiConfidenceLevel || data.aiRiskLevel) && (
            <div className="grid grid-cols-2 gap-2">
              {data.aiConfidenceLevel && data.aiConfidenceLevel !== "unavailable" && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Detection Confidence</div>
                  <div className="text-sm font-medium capitalize">{data.aiConfidenceLevel}</div>
                </div>
              )}
              {data.aiRiskLevel && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Authorship Risk</div>
                  <div className={cn("text-sm font-medium capitalize",
                    data.aiRiskLevel === "critical" ? "text-red-600 dark:text-red-400" :
                    data.aiRiskLevel === "high" ? "text-orange-500" :
                    data.aiRiskLevel === "moderate" ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {data.aiRiskLevel}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detection indicators */}
          {data.aiDetectionReasons && data.aiDetectionReasons.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Detection Indicators</div>
              <div className="flex flex-wrap gap-1">
                {data.aiDetectionReasons.map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Override reason */}
          {data.aiOverrideReason && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Admin Note</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{data.aiOverrideReason}</p>
            </div>
          )}

          {/* Tag lock status */}
          {data.tagLocked ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              Classification is locked. Creators cannot change this tag.
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockOpen className="w-3.5 h-3.5" />
              Classification is unlocked. Creator may update their declaration.
            </div>
          )}

          {/* Scan trigger */}
          {(isAdmin || isModerator) && onScanRequest && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={onScanRequest}
            >
              <Scan className="w-3.5 h-3.5" />
              Request Detection Scan
            </Button>
          )}

          {/* Admin / moderator action panel */}
          {(isAdmin || isModerator) && onAction && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="text-xs font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                {isAdmin ? "Admin Actions" : "Moderator Actions"}
              </div>

              {/* Note: moderators cannot permanently lock or make final classification */}
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground">
                  Moderators may flag and escalate. Only admins may assign a locked platform classification, approve, reject, or make a final appeal decision.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {(isAdmin ? ADMIN_ACTIONS : MOD_ACTIONS).map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setSelectedAction(selectedAction === a.value ? "" : a.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                      selectedAction === a.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {selectedAction && (
                <div className="space-y-2">
                  {selectedAction === "assign_tag" && (
                    <select
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background"
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                    >
                      <option value="">— Select classification —</option>
                      {TAG_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  )}

                  {["assign_tag", "lock", "reject"].includes(selectedAction) && (
                    <Textarea
                      placeholder="Required: written reason for this action…"
                      className="text-xs min-h-[70px]"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  )}

                  <Button
                    type="button"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={handleAction}
                    disabled={actionLoading ||
                      (selectedAction === "assign_tag" && (!selectedTag || !reason)) ||
                      (["lock", "reject"].includes(selectedAction) && !reason)
                    }
                  >
                    {actionLoading ? "Applying…" : "Apply"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
