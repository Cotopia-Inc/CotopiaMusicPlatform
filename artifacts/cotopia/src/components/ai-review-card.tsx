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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, LockOpen, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, Scan, History, X, Loader2 } from "lucide-react";
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

interface ScanRecord {
  id: number;
  scanStatus: string;
  provider: string;
  aiLikelihoodPercent: number | null;
  confidenceLevel: string | null;
  riskLevel: string | null;
  detectionIndicators: string[] | null;
  rawResult: Record<string, unknown> | null;
  errorMessage: string | null;
  scannedAt: string | null;
  createdAt: string;
}

/** Parse the full per-class score breakdown stored in rawResult from Hive V3.
 *  Aggregates across ALL output items (one per segment for chunked scans)
 *  by taking the worst-case (max) score per class name. */
function parseClassBreakdown(
  rawResult: Record<string, unknown> | null | undefined,
): Array<{ name: string; percent: number }> | null {
  if (!rawResult) return null;
  try {
    const statusArr = rawResult["status"] as Array<Record<string, unknown>> | undefined;
    const response = statusArr?.[0]?.["response"] as Record<string, unknown> | undefined;
    const output = response?.["output"] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(output) || output.length === 0) return null;
    const maxPerClass = new Map<string, number>();
    for (const item of output) {
      const classes = item["classes"] as Array<{ class: string; score: number }> | undefined;
      if (!Array.isArray(classes)) continue;
      for (const cls of classes) {
        const pct = Math.round(cls.score * 100);
        const existing = maxPerClass.get(cls.class) ?? 0;
        if (pct > existing) maxPerClass.set(cls.class, pct);
      }
    }
    if (maxPerClass.size === 0) return null;
    return Array.from(maxPerClass.entries())
      .map(([name, percent]) => ({ name: name.replace(/_/g, " "), percent }))
      .sort((a, b) => b.percent - a.percent);
  } catch {
    return null;
  }
}

/** Count how many segments Hive processed (output items in status[0].response.output). */
function getSegmentCount(rawResult: Record<string, unknown> | null | undefined): number {
  if (!rawResult) return 0;
  try {
    const statusArr = rawResult["status"] as Array<Record<string, unknown>> | undefined;
    const response = statusArr?.[0]?.["response"] as Record<string, unknown> | undefined;
    const output = response?.["output"] as Array<Record<string, unknown>> | undefined;
    return Array.isArray(output) ? output.length : 0;
  } catch {
    return 0;
  }
}

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
  const [scanRequesting, setScanRequesting] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [reason, setReason] = useState("");

  const queryClient = useQueryClient();

  const { data: scanHistory } = useQuery<ScanRecord[]>({
    queryKey: ["ai-scans", contentType, contentId],
    queryFn: async () => {
      const token = localStorage.getItem("cotopia_token");
      const res = await fetch(`/api/admin/ai-scans/${contentType}/${contentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: (isAdmin || isModerator) && !!contentId,
    refetchInterval: data.aiReviewStatus === "scan_pending" ? 5000 : false,
    staleTime: 10_000,
  });

  async function handleDeleteScan(scanId: number) {
    const token = localStorage.getItem("cotopia_token");
    await fetch(`/api/admin/ai-scans/${scanId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    queryClient.invalidateQueries({ queryKey: ["ai-scans", contentType, contentId] });
  }

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
              disabled={scanRequesting || data.aiReviewStatus === "scan_pending"}
              onClick={async () => {
                if (scanRequesting || data.aiReviewStatus === "scan_pending") return;
                setScanRequesting(true);
                try {
                  await onScanRequest();
                } finally {
                  setScanRequesting(false);
                }
              }}
            >
              {(scanRequesting || data.aiReviewStatus === "scan_pending") ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scanning…</>
              ) : (
                <><Scan className="w-3.5 h-3.5" />Request Detection Scan</>
              )}
            </Button>
          )}

          {/* Scan history */}
          {(isAdmin || isModerator) && scanHistory && scanHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <History className="w-3 h-3" />
                Scan History ({scanHistory.length})
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                {scanHistory.map((scan) => {
                  const statusColor =
                    scan.scanStatus === "complete" ? "text-emerald-600 dark:text-emerald-400" :
                    scan.scanStatus === "failed" ? "text-red-500" :
                    "text-muted-foreground";
                  const ts = scan.scannedAt ?? scan.createdAt;
                  const dateStr = ts ? new Date(ts).toLocaleString() : "—";
                  return (
                    <div
                      key={scan.id}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-medium capitalize", statusColor)}>
                          {scan.scanStatus}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground tabular-nums">{dateStr}</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteScan(scan.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              aria-label="Delete scan record"
                              title="Delete this scan record"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {scan.scanStatus === "complete" && (
                        <div className="space-y-2">
                          {/* Summary row — only when a numeric score was extracted */}
                          {scan.aiLikelihoodPercent !== null ? (
                            <div className="flex flex-wrap items-center gap-3 text-[11px]">
                              <span>
                                AI likelihood: <strong className={cn("tabular-nums",
                                  scan.aiLikelihoodPercent >= 90 ? "text-red-500" :
                                  scan.aiLikelihoodPercent >= 60 ? "text-orange-500" :
                                  scan.aiLikelihoodPercent >= 25 ? "text-amber-500" : "text-emerald-500"
                                )}>{scan.aiLikelihoodPercent}%</strong>
                              </span>
                              {scan.riskLevel && (
                                <span className="capitalize text-muted-foreground">
                                  Risk: <strong className={cn(
                                    scan.riskLevel === "critical" ? "text-red-500" :
                                    scan.riskLevel === "high" ? "text-orange-500" :
                                    scan.riskLevel === "moderate" ? "text-amber-500" : "text-emerald-500"
                                  )}>{scan.riskLevel}</strong>
                                </span>
                              )}
                              {scan.confidenceLevel && scan.confidenceLevel !== "unavailable" && (
                                <span className="capitalize text-muted-foreground">
                                  Confidence: <strong>{scan.confidenceLevel}</strong>
                                </span>
                              )}
                              {(() => {
                                const segCount = getSegmentCount(scan.rawResult);
                                return segCount > 1 ? (
                                  <span className="text-muted-foreground">
                                    Segments: <strong>{segCount}</strong>
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground italic">
                              Score not extracted — see class breakdown below for raw Hive output.
                            </div>
                          )}
                          {/* Full class-by-class breakdown from rawResult — always shown for complete scans */}
                          {(() => {
                            const breakdown = parseClassBreakdown(scan.rawResult);
                            if (!breakdown || breakdown.length === 0) return null;
                            return (
                              <div className="space-y-1 pt-0.5">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Full Detection Breakdown</div>
                                {breakdown.map(({ name, percent }) => (
                                  <div key={name} className="flex items-center gap-2">
                                    <div className="text-[10px] text-muted-foreground capitalize w-40 shrink-0 truncate" title={name}>{name}</div>
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={cn("h-full rounded-full transition-all",
                                          percent >= 90 ? "bg-red-500" :
                                          percent >= 60 ? "bg-orange-500" :
                                          percent >= 25 ? "bg-amber-400" : "bg-emerald-500"
                                        )}
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                    <div className="text-[10px] font-semibold tabular-nums w-9 text-right">{percent}%</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {/* Raw Hive response — shown when breakdown is empty so admins can diagnose the actual response */}
                          {(() => {
                            const breakdown = parseClassBreakdown(scan.rawResult);
                            if (breakdown && breakdown.length > 0) return null;
                            if (!scan.rawResult) return null;
                            return (
                              <details className="text-[10px] pt-0.5">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                  Raw Hive response (debug)
                                </summary>
                                <pre className="mt-1.5 text-[9px] text-muted-foreground bg-muted/40 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                                  {JSON.stringify(scan.rawResult, null, 2)}
                                </pre>
                              </details>
                            );
                          })()}
                        </div>
                      )}
                      {scan.detectionIndicators && scan.detectionIndicators.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {scan.detectionIndicators.map((ind) => (
                            <Badge key={ind} variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">{ind.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      )}
                      {scan.scanStatus === "failed" && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 mt-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="text-[11px] font-medium text-red-600 dark:text-red-400">Scan failed</div>
                              {scan.errorMessage && (
                                <div className="text-[10px] text-red-500/80 break-all leading-relaxed">{scan.errorMessage}</div>
                              )}
                            </div>
                            {onScanRequest && (isAdmin || isModerator) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-6 px-2 shrink-0 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                                disabled={scanRequesting || data.aiReviewStatus === "scan_pending"}
                                onClick={async () => {
                                  setScanRequesting(true);
                                  try { await onScanRequest(); } finally { setScanRequesting(false); }
                                }}
                              >
                                {scanRequesting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retry"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {scan.scanStatus === "unavailable" && (
                        <div className="text-[10px] text-muted-foreground">
                          Provider returned no result — file may be too small or key unconfigured.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
                      aria-label="Reason for action"
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
